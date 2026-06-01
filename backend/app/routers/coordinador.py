from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_roles
from app.models.solicitud import EstadoEnum, HistorialEstado, Solicitud
from app.models.tramite import TipoTramite
from app.models.usuario import RolEnum, Usuario
from app.services.notificaciones import create_notification

router = APIRouter(prefix="/coordinator", tags=["coordinator"])

COORD = (RolEnum.coordinator,)


# ── Schemas ───────────────────────────────────────────────────────────────────

class RequestTypeCreate(BaseModel):
    name: str
    description: str | None = None
    required_docs: list[str] = []
    deadline_days: int | None = None
    active: bool = True
    requires_account: bool = True


class RequestTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    required_docs: list[str] | None = None
    deadline_days: int | None = None
    active: bool | None = None
    requires_account: bool | None = None


class ResolveBody(BaseModel):
    action: str  # approve | reject
    comment: str


# ── Request types ─────────────────────────────────────────────────────────────

@router.get("/request-types")
def list_request_types(
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    types = db.query(TipoTramite).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "required_docs": t.required_docs,
            "deadline_days": t.deadline_days,
            "active": t.active,
            "requires_account": t.requires_account,
        }
        for t in types
    ]


@router.post("/request-types", status_code=status.HTTP_201_CREATED)
def create_request_type(
    body: RequestTypeCreate,
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    t = TipoTramite(**body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name}


@router.put("/request-types/{id}")
def update_request_type(
    id: int,
    body: RequestTypeUpdate,
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    t = db.query(TipoTramite).filter(TipoTramite.id == id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Request type not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(t, field, value)

    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name, "active": t.active}


@router.delete("/request-types/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_request_type(
    id: int,
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    t = db.query(TipoTramite).filter(TipoTramite.id == id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Request type not found")
    db.delete(t)
    db.commit()


# ── Escalated requests ────────────────────────────────────────────────────────

@router.get("/escalated-requests")
def escalated_requests(
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    reqs = db.query(Solicitud).filter(Solicitud.status == EstadoEnum.escalated).order_by(Solicitud.updated_at.asc()).all()
    return [
        {
            "id": r.id,
            "ticket": r.ticket,
            "request_type": r.request_type.name,
            "user": f"{r.user.first_name} {r.user.last_name}" if r.user else r.applicant_national_id,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
        }
        for r in reqs
    ]


@router.post("/requests/{id}/resolve")
def resolve_escalated(
    id: int,
    body: ResolveBody,
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    req = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != EstadoEnum.escalated:
        raise HTTPException(status_code=400, detail="Request is not escalated")

    status_map = {"approve": EstadoEnum.approved, "reject": EstadoEnum.rejected}
    new_status = status_map.get(body.action)
    if not new_status:
        raise HTTPException(status_code=400, detail="Invalid action")

    previous = req.status
    req.status = new_status
    req.updated_at = datetime.utcnow()

    db.add(HistorialEstado(
        request_id=req.id,
        operator_id=current_user.id,
        previous_status=previous,
        new_status=new_status,
        comment=body.comment,
        is_internal=False,
    ))

    if req.user_id:
        messages = {
            "approve": "Your escalated request was approved by the coordinator.",
            "reject": f"Your request was rejected by the coordinator. Reason: {body.comment}",
        }
        create_notification(db, req.user_id, req.id, messages[body.action])

    db.commit()
    return {"detail": f"Request {body.action}d successfully"}


# ── User management ───────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    users = db.query(Usuario).filter(Usuario.role.in_([RolEnum.operator, RolEnum.coordinator])).all()
    return [
        {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "email": u.email,
            "role": u.role,
            "active": u.active,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.post("/users/{id}/toggle-active")
def toggle_active(
    id: int,
    current_user: Usuario = Depends(require_roles(*COORD)),
    db: Session = Depends(get_db),
):
    user = db.query(Usuario).filter(Usuario.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role not in (RolEnum.operator, RolEnum.coordinator):
        raise HTTPException(status_code=400, detail="Can only manage operators and coordinators")

    user.active = not user.active
    db.commit()
    return {"id": user.id, "active": user.active}
