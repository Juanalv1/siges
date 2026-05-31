from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_roles
from app.models.solicitud import EstadoEnum, HistorialEstado, Solicitud
from app.models.tramite import TipoTramite
from app.models.usuario import RolEnum, Usuario
from app.services.notificaciones import crear_notificacion

router = APIRouter(prefix="/coordinador", tags=["coordinador"])

COORD = (RolEnum.coordinador,)


# ── Schemas ───────────────────────────────────────────────────────────────────

class TipoTramiteCreate(BaseModel):
    nombre: str
    descripcion: str | None = None
    docs_requeridos: list[str] = []
    dias_limite: int | None = None
    activo: bool = True
    requiere_cuenta: bool = True


class TipoTramiteUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    docs_requeridos: list[str] | None = None
    dias_limite: int | None = None
    activo: bool | None = None
    requiere_cuenta: bool | None = None


class ResolverBody(BaseModel):
    accion: str  # aprobar | rechazar
    comentario: str


# ── Tipos de trámite ──────────────────────────────────────────────────────────

@router.get("/tipos-tramite")
def listar_tipos(
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    tipos = db.query(TipoTramite).all()
    return [
        {
            "id": t.id,
            "nombre": t.nombre,
            "descripcion": t.descripcion,
            "docs_requeridos": t.docs_requeridos,
            "dias_limite": t.dias_limite,
            "activo": t.activo,
            "requiere_cuenta": t.requiere_cuenta,
        }
        for t in tipos
    ]


@router.post("/tipos-tramite", status_code=status.HTTP_201_CREATED)
def crear_tipo(
    body: TipoTramiteCreate,
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    t = TipoTramite(**body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "nombre": t.nombre}


@router.put("/tipos-tramite/{id}")
def actualizar_tipo(
    id: int,
    body: TipoTramiteUpdate,
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    t = db.query(TipoTramite).filter(TipoTramite.id == id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tipo de trámite no encontrado")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(t, field, value)

    db.commit()
    db.refresh(t)
    return {"id": t.id, "nombre": t.nombre, "activo": t.activo}


@router.delete("/tipos-tramite/{id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_tipo(
    id: int,
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    t = db.query(TipoTramite).filter(TipoTramite.id == id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tipo de trámite no encontrado")
    db.delete(t)
    db.commit()


# ── Solicitudes escaladas ─────────────────────────────────────────────────────

@router.get("/solicitudes-escaladas")
def solicitudes_escaladas(
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    solicitudes = db.query(Solicitud).filter(Solicitud.estado == EstadoEnum.escalada).order_by(Solicitud.updated_at.asc()).all()
    return [
        {
            "id": s.id,
            "ticket": s.ticket,
            "tipo_tramite": s.tipo_tramite.nombre,
            "usuario": f"{s.usuario.nombre} {s.usuario.apellido}" if s.usuario else s.cedula_solicitante,
            "estado": s.estado,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat(),
        }
        for s in solicitudes
    ]


@router.post("/solicitudes/{id}/resolver")
def resolver_escalada(
    id: int,
    body: ResolverBody,
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    s = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if s.estado != EstadoEnum.escalada:
        raise HTTPException(status_code=400, detail="La solicitud no está escalada")

    mapa = {"aprobar": EstadoEnum.aprobada, "rechazar": EstadoEnum.rechazada}
    nuevo_estado = mapa.get(body.accion)
    if not nuevo_estado:
        raise HTTPException(status_code=400, detail="Acción inválida")

    estado_ant = s.estado
    s.estado = nuevo_estado
    s.updated_at = datetime.utcnow()

    db.add(HistorialEstado(
        solicitud_id=s.id,
        operador_id=current_user.id,
        estado_anterior=estado_ant,
        estado_nuevo=nuevo_estado,
        comentario=body.comentario,
        es_interno=False,
    ))

    if s.usuario_id:
        msg = {
            "aprobar": "Tu solicitud escalada fue aprobada por el coordinador.",
            "rechazar": f"Tu solicitud fue rechazada por el coordinador. Motivo: {body.comentario}",
        }
        crear_notificacion(db, s.usuario_id, s.id, msg[body.accion])

    db.commit()
    return {"detail": f"Solicitud {body.accion}da correctamente"}


# ── Gestión de usuarios ───────────────────────────────────────────────────────

@router.get("/usuarios")
def listar_usuarios(
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    usuarios = db.query(Usuario).filter(Usuario.rol.in_([RolEnum.operador, RolEnum.coordinador])).all()
    return [
        {
            "id": u.id,
            "nombre": u.nombre,
            "apellido": u.apellido,
            "correo": u.correo,
            "rol": u.rol,
            "activo": u.activo,
            "created_at": u.created_at.isoformat(),
        }
        for u in usuarios
    ]


@router.post("/usuarios/{id}/toggle-activo")
def toggle_activo(
    id: int,
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    u = db.query(Usuario).filter(Usuario.id == id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if u.rol not in (RolEnum.operador, RolEnum.coordinador):
        raise HTTPException(status_code=400, detail="Solo se pueden gestionar operadores y coordinadores")

    u.activo = not u.activo
    db.commit()
    return {"id": u.id, "activo": u.activo}
