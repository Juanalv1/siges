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
from app.services.sogac import verify_student

router = APIRouter(tags=["requests"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def generate_ticket() -> str:
    now = datetime.utcnow()
    suffix = ''.join(random.choices(string.digits, k=5))
    return f"SIG-{now.year}{now.month:02d}-{suffix}"


def _request_response(req: Solicitud, include_internal: bool = False):
    return {
        "id": req.id,
        "ticket": req.ticket,
        "request_type": {"id": req.request_type.id, "name": req.request_type.name},
        "status": req.status,
        "description": req.description,
        "applicant_national_id": req.applicant_national_id,
        "created_at": req.created_at.isoformat(),
        "updated_at": req.updated_at.isoformat(),
        "history": [
            {
                "previous_status": h.previous_status,
                "new_status": h.new_status,
                "comment": h.comment,
                "date": h.date.isoformat(),
                "is_internal": h.is_internal,
            }
            for h in req.history
            if include_internal or not h.is_internal
        ],
        "documents": [
            {"id": d.id, "filename": d.filename, "url": f"/uploads/{os.path.basename(d.path)}"}
            for d in req.documents
        ],
    }


# ── Request types ─────────────────────────────────────────────────────────────

@router.get("/request-types")
def get_request_types(db: Session = Depends(get_db)):
    types = db.query(TipoTramite).filter(TipoTramite.active == True).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "required_docs": t.required_docs,
            "deadline_days": t.deadline_days,
            "requires_account": t.requires_account,
        }
        for t in types
    ]


# ── Documents ─────────────────────────────────────────────────────────────────

@router.post("/documents/upload")
async def upload_document(
    archivo: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    os.makedirs(settings.uploads_dir, exist_ok=True)
    unique_name = f"{datetime.utcnow().timestamp()}_{current_user.id}_{archivo.filename}"
    file_path = os.path.join(settings.uploads_dir, unique_name)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(archivo.file, f)

    doc = Documento(
        user_id=current_user.id,
        filename=archivo.filename,
        path=file_path,
        mime_type=archivo.content_type,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "filename": doc.filename}


# ── Authenticated requests ────────────────────────────────────────────────────

class CreateRequestBody(BaseModel):
    request_type_id: int
    description: str | None = None
    document_ids: list[int] = []


@router.post("/requests", status_code=status.HTTP_201_CREATED)
def create_request(
    body: CreateRequestBody,
    current_user: Usuario = Depends(require_roles(RolEnum.student)),
    db: Session = Depends(get_db),
):
    req_type = db.query(TipoTramite).filter(TipoTramite.id == body.request_type_id, TipoTramite.active == True).first()
    if not req_type:
        raise HTTPException(status_code=404, detail="Request type not found")
    if not req_type.requires_account:
        raise HTTPException(status_code=400, detail="This request type does not require an account")

    ticket = generate_ticket()
    req = Solicitud(
        ticket=ticket,
        user_id=current_user.id,
        request_type_id=req_type.id,
        status=EstadoEnum.pending,
        description=body.description,
    )
    db.add(req)
    db.flush()

    for doc_id in body.document_ids:
        doc = db.query(Documento).filter(Documento.id == doc_id, Documento.user_id == current_user.id).first()
        if doc:
            doc.request_id = req.id

    db.add(HistorialEstado(
        request_id=req.id,
        previous_status=None,
        new_status=EstadoEnum.pending,
        comment="Request created",
    ))
    db.commit()
    db.refresh(req)
    return {"ticket": req.ticket, "id": req.id, "status": req.status}


@router.get("/requests/my-requests")
def my_requests(
    current_user: Usuario = Depends(require_roles(RolEnum.student)),
    db: Session = Depends(get_db),
):
    reqs = db.query(Solicitud).filter(Solicitud.user_id == current_user.id).order_by(Solicitud.created_at.desc()).all()
    return [_request_response(r) for r in reqs]


@router.get("/requests/{ticket}")
def get_request(
    ticket: str,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req = db.query(Solicitud).filter(Solicitud.ticket == ticket).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    is_staff = current_user.role in (RolEnum.operator, RolEnum.coordinator)
    if not is_staff and req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return _request_response(req, include_internal=is_staff)


# ── Enrollment without account ────────────────────────────────────────────────

@router.post("/requests/enrollment", status_code=status.HTTP_201_CREATED)
async def create_enrollment(
    national_id: str = Form(...),
    archivos: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if not verify_student(national_id):
        raise HTTPException(status_code=400, detail="National ID not found in the system")

    req_type = db.query(TipoTramite).filter(TipoTramite.requires_account == False, TipoTramite.active == True).first()
    if not req_type:
        raise HTTPException(status_code=404, detail="Enrollment request type not configured")

    ticket = generate_ticket()
    req = Solicitud(
        ticket=ticket,
        user_id=None,
        applicant_national_id=national_id,
        request_type_id=req_type.id,
        status=EstadoEnum.pending,
    )
    db.add(req)
    db.flush()

    os.makedirs(settings.uploads_dir, exist_ok=True)
    for archivo in archivos:
        unique_name = f"{datetime.utcnow().timestamp()}_{national_id}_{archivo.filename}"
        file_path = os.path.join(settings.uploads_dir, unique_name)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(archivo.file, f)
        db.add(Documento(
            request_id=req.id,
            filename=archivo.filename,
            path=file_path,
            mime_type=archivo.content_type,
        ))

    db.add(HistorialEstado(
        request_id=req.id,
        previous_status=None,
        new_status=EstadoEnum.pending,
        comment="Enrollment submitted",
    ))
    db.commit()
    return {"ticket": req.ticket}
