import os
import random
import shutil
import string
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user, get_db, require_roles
from app.models.documento import Documento
from app.models.solicitud import EstadoEnum, HistorialEstado, Solicitud
from app.models.tramite import TipoTramite
from app.models.usuario import RolEnum, Usuario
from app.services.sogac import verificar_estudiante

router = APIRouter(tags=["solicitudes"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def generar_ticket() -> str:
    now = datetime.utcnow()
    suffix = ''.join(random.choices(string.digits, k=5))
    return f"SIG-{now.year}{now.month:02d}-{suffix}"


def _solicitud_response(s: Solicitud, include_internal: bool = False):
    return {
        "id": s.id,
        "ticket": s.ticket,
        "tipo_tramite": {"id": s.tipo_tramite.id, "nombre": s.tipo_tramite.nombre},
        "estado": s.estado,
        "descripcion": s.descripcion,
        "cedula_solicitante": s.cedula_solicitante,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
        "historial": [
            {
                "estado_anterior": h.estado_anterior,
                "estado_nuevo": h.estado_nuevo,
                "comentario": h.comentario,
                "fecha": h.fecha.isoformat(),
                "es_interno": h.es_interno,
            }
            for h in s.historial
            if include_internal or not h.es_interno
        ],
        "documentos": [
            {"id": d.id, "nombre_archivo": d.nombre_archivo, "url": f"/uploads/{os.path.basename(d.ruta)}"}
            for d in s.documentos
        ],
    }


# ── Tipos de trámite ──────────────────────────────────────────────────────────

@router.get("/tipos-tramite")
def get_tipos_tramite(db: Session = Depends(get_db)):
    tipos = db.query(TipoTramite).filter(TipoTramite.activo == True).all()
    return [
        {
            "id": t.id,
            "nombre": t.nombre,
            "descripcion": t.descripcion,
            "docs_requeridos": t.docs_requeridos,
            "dias_limite": t.dias_limite,
            "requiere_cuenta": t.requiere_cuenta,
        }
        for t in tipos
    ]


# ── Documentos ────────────────────────────────────────────────────────────────

@router.post("/documentos/subir")
async def subir_documento(
    archivo: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    os.makedirs(settings.uploads_dir, exist_ok=True)
    ext = os.path.splitext(archivo.filename)[1]
    nombre_unico = f"{datetime.utcnow().timestamp()}_{current_user.id}_{archivo.filename}"
    ruta = os.path.join(settings.uploads_dir, nombre_unico)
    with open(ruta, "wb") as f:
        shutil.copyfileobj(archivo.file, f)

    doc = Documento(
        usuario_id=current_user.id,
        nombre_archivo=archivo.filename,
        ruta=ruta,
        tipo_mime=archivo.content_type,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "nombre_archivo": doc.nombre_archivo}


# ── Solicitudes autenticadas ──────────────────────────────────────────────────

class CrearSolicitudBody(BaseModel):
    tipo_tramite_id: int
    descripcion: str | None = None
    documento_ids: list[int] = []


@router.post("/solicitudes", status_code=status.HTTP_201_CREATED)
def crear_solicitud(
    body: CrearSolicitudBody,
    current_user: Usuario = Depends(require_roles(RolEnum.estudiante)),
    db: Session = Depends(get_db),
):
    tipo = db.query(TipoTramite).filter(TipoTramite.id == body.tipo_tramite_id, TipoTramite.activo == True).first()
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de trámite no encontrado")
    if not tipo.requiere_cuenta:
        raise HTTPException(status_code=400, detail="Este trámite no requiere cuenta")

    ticket = generar_ticket()
    solicitud = Solicitud(
        ticket=ticket,
        usuario_id=current_user.id,
        tipo_tramite_id=tipo.id,
        estado=EstadoEnum.pendiente,
        descripcion=body.descripcion,
    )
    db.add(solicitud)
    db.flush()

    for doc_id in body.documento_ids:
        doc = db.query(Documento).filter(Documento.id == doc_id, Documento.usuario_id == current_user.id).first()
        if doc:
            doc.solicitud_id = solicitud.id

    db.add(HistorialEstado(
        solicitud_id=solicitud.id,
        estado_anterior=None,
        estado_nuevo=EstadoEnum.pendiente,
        comentario="Solicitud creada",
    ))
    db.commit()
    db.refresh(solicitud)
    return {"ticket": solicitud.ticket, "id": solicitud.id, "estado": solicitud.estado}


@router.get("/solicitudes/mis-solicitudes")
def mis_solicitudes(
    current_user: Usuario = Depends(require_roles(RolEnum.estudiante)),
    db: Session = Depends(get_db),
):
    solicitudes = db.query(Solicitud).filter(Solicitud.usuario_id == current_user.id).order_by(Solicitud.created_at.desc()).all()
    return [_solicitud_response(s) for s in solicitudes]


@router.get("/solicitudes/{ticket}")
def ver_solicitud(
    ticket: str,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(Solicitud).filter(Solicitud.ticket == ticket).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    is_staff = current_user.rol in (RolEnum.operador, RolEnum.coordinador)
    if not is_staff and s.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta solicitud")

    return _solicitud_response(s, include_internal=is_staff)


# ── Inscripción sin cuenta ────────────────────────────────────────────────────

@router.post("/solicitudes/inscripcion", status_code=status.HTTP_201_CREATED)
async def crear_inscripcion(
    cedula: str = Form(...),
    archivos: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if not verificar_estudiante(cedula):
        raise HTTPException(status_code=400, detail="Cédula no encontrada en el sistema")

    tipo = db.query(TipoTramite).filter(TipoTramite.requiere_cuenta == False, TipoTramite.activo == True).first()
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de trámite de inscripción no configurado")

    ticket = generar_ticket()
    solicitud = Solicitud(
        ticket=ticket,
        usuario_id=None,
        cedula_solicitante=cedula,
        tipo_tramite_id=tipo.id,
        estado=EstadoEnum.pendiente,
    )
    db.add(solicitud)
    db.flush()

    os.makedirs(settings.uploads_dir, exist_ok=True)
    for archivo in archivos:
        nombre_unico = f"{datetime.utcnow().timestamp()}_{cedula}_{archivo.filename}"
        ruta = os.path.join(settings.uploads_dir, nombre_unico)
        with open(ruta, "wb") as f:
            shutil.copyfileobj(archivo.file, f)
        db.add(Documento(
            solicitud_id=solicitud.id,
            nombre_archivo=archivo.filename,
            ruta=ruta,
            tipo_mime=archivo.content_type,
        ))

    db.add(HistorialEstado(
        solicitud_id=solicitud.id,
        estado_anterior=None,
        estado_nuevo=EstadoEnum.pendiente,
        comentario="Inscripción enviada",
    ))
    db.commit()
    return {"ticket": solicitud.ticket}
