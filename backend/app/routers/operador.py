from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_roles
from app.models.solicitud import EstadoEnum, HistorialEstado, Solicitud
from app.models.usuario import RolEnum, Usuario
from app.services.notificaciones import crear_notificacion

router = APIRouter(prefix="/operador", tags=["operador"])

STAFF_ROLES = (RolEnum.operador, RolEnum.coordinador)


def _solicitud_full(s: Solicitud):
    return {
        "id": s.id,
        "ticket": s.ticket,
        "tipo_tramite": {"id": s.tipo_tramite.id, "nombre": s.tipo_tramite.nombre},
        "estado": s.estado,
        "descripcion": s.descripcion,
        "cedula_solicitante": s.cedula_solicitante,
        "usuario": (
            {"id": s.usuario.id, "nombre": s.usuario.nombre, "apellido": s.usuario.apellido, "cedula": s.usuario.cedula}
            if s.usuario else None
        ),
        "operador_id": s.operador_id,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
        "historial": [
            {
                "estado_anterior": h.estado_anterior,
                "estado_nuevo": h.estado_nuevo,
                "comentario": h.comentario,
                "es_interno": h.es_interno,
                "fecha": h.fecha.isoformat(),
                "operador": h.operador.nombre if h.operador else None,
            }
            for h in s.historial
        ],
        "documentos": [
            {"id": d.id, "nombre_archivo": d.nombre_archivo, "url": f"/uploads/{d.nombre_archivo}"}
            for d in s.documentos
        ],
    }


# ── Bandeja ───────────────────────────────────────────────────────────────────

@router.get("/bandeja")
def get_bandeja(
    tipo_tramite_id: int | None = Query(None),
    estado: str | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    current_user: Usuario = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    q = db.query(Solicitud).filter(
        Solicitud.estado.in_([EstadoEnum.pendiente, EstadoEnum.en_atencion])
    )
    if tipo_tramite_id:
        q = q.filter(Solicitud.tipo_tramite_id == tipo_tramite_id)
    if estado:
        q = q.filter(Solicitud.estado == estado)
    if fecha_desde:
        q = q.filter(Solicitud.created_at >= datetime.fromisoformat(fecha_desde))
    if fecha_hasta:
        q = q.filter(Solicitud.created_at <= datetime.fromisoformat(fecha_hasta))

    solicitudes = q.order_by(Solicitud.created_at.asc()).all()
    return [
        {
            "id": s.id,
            "ticket": s.ticket,
            "tipo_tramite": s.tipo_tramite.nombre,
            "estado": s.estado,
            "cedula_solicitante": s.cedula_solicitante,
            "usuario": f"{s.usuario.nombre} {s.usuario.apellido}" if s.usuario else s.cedula_solicitante,
            "created_at": s.created_at.isoformat(),
            "operador_id": s.operador_id,
        }
        for s in solicitudes
    ]


# ── Abrir solicitud ───────────────────────────────────────────────────────────

@router.post("/solicitudes/{id}/abrir")
def abrir_solicitud(
    id: int,
    current_user: Usuario = Depends(require_roles(RolEnum.operador, RolEnum.coordinador)),
    db: Session = Depends(get_db),
):
    s = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if s.estado == EstadoEnum.en_atencion and s.operador_id != current_user.id:
        raise HTTPException(status_code=409, detail="Ya está siendo atendida por otro operador")

    estado_ant = s.estado
    s.estado = EstadoEnum.en_atencion
    s.operador_id = current_user.id
    s.updated_at = datetime.utcnow()

    db.add(HistorialEstado(
        solicitud_id=s.id,
        operador_id=current_user.id,
        estado_anterior=estado_ant,
        estado_nuevo=EstadoEnum.en_atencion,
        comentario=f"En atención por {current_user.nombre}",
        es_interno=True,
    ))
    db.commit()
    return {"detail": "Solicitud en atención"}


# ── Liberar solicitud ─────────────────────────────────────────────────────────

@router.post("/solicitudes/{id}/liberar")
def liberar_solicitud(
    id: int,
    current_user: Usuario = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    s = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if s.estado != EstadoEnum.en_atencion:
        return {"detail": "No estaba en atención"}

    s.estado = EstadoEnum.pendiente
    s.operador_id = None
    s.updated_at = datetime.utcnow()

    db.add(HistorialEstado(
        solicitud_id=s.id,
        operador_id=current_user.id,
        estado_anterior=EstadoEnum.en_atencion,
        estado_nuevo=EstadoEnum.pendiente,
        comentario="Devuelta a pendiente",
        es_interno=True,
    ))
    db.commit()
    return {"detail": "Solicitud devuelta a pendiente"}


# ── Acción sobre solicitud ────────────────────────────────────────────────────

class AccionBody(BaseModel):
    accion: str  # aprobar | rechazar | escalar | comentario
    comentario: str | None = None
    es_interno: bool = False


ACCION_ESTADO = {
    "aprobar": EstadoEnum.aprobada,
    "rechazar": EstadoEnum.rechazada,
    "escalar": EstadoEnum.escalada,
}


@router.post("/solicitudes/{id}/accion")
def accion_solicitud(
    id: int,
    body: AccionBody,
    current_user: Usuario = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    s = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    if body.accion == "rechazar" and not body.comentario:
        raise HTTPException(status_code=400, detail="El rechazo requiere un comentario")

    if body.accion == "comentario":
        db.add(HistorialEstado(
            solicitud_id=s.id,
            operador_id=current_user.id,
            estado_anterior=s.estado,
            estado_nuevo=s.estado,
            comentario=body.comentario,
            es_interno=body.es_interno,
        ))
        db.commit()
        return {"detail": "Comentario agregado"}

    nuevo_estado = ACCION_ESTADO.get(body.accion)
    if not nuevo_estado:
        raise HTTPException(status_code=400, detail=f"Acción desconocida: {body.accion}")

    estado_ant = s.estado
    s.estado = nuevo_estado
    s.updated_at = datetime.utcnow()

    db.add(HistorialEstado(
        solicitud_id=s.id,
        operador_id=current_user.id,
        estado_anterior=estado_ant,
        estado_nuevo=nuevo_estado,
        comentario=body.comentario,
        es_interno=body.es_interno,
    ))

    if s.usuario_id and not body.es_interno:
        mensajes = {
            "aprobar": "Tu solicitud ha sido aprobada.",
            "rechazar": f"Tu solicitud fue rechazada. Motivo: {body.comentario}",
            "escalar": "Tu solicitud fue escalada al coordinador para revisión.",
        }
        crear_notificacion(db, s.usuario_id, s.id, mensajes.get(body.accion, "Tu solicitud fue actualizada."))

    db.commit()
    return {"detail": f"Solicitud {body.accion}da correctamente"}


# ── Ver solicitud completa ────────────────────────────────────────────────────

@router.get("/solicitudes/{id}")
def ver_solicitud_operador(
    id: int,
    current_user: Usuario = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    s = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return _solicitud_full(s)
