from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_roles
from app.models.solicitud import EstadoEnum, HistorialEstado, Solicitud
from app.models.usuario import RolEnum, Usuario
from app.services.notificaciones import create_notification

router = APIRouter(prefix="/operator", tags=["operator"])

STAFF_ROLES = (RolEnum.operator, RolEnum.coordinator)


def _request_full(req: Solicitud):
    return {
        "id": req.id,
        "ticket": req.ticket,
        "request_type": {"id": req.request_type.id, "name": req.request_type.name},
        "status": req.status,
        "description": req.description,
        "applicant_national_id": req.applicant_national_id,
        "user": (
            {
                "id": req.user.id,
                "first_name": req.user.first_name,
                "last_name": req.user.last_name,
                "national_id": req.user.national_id,
            }
            if req.user else None
        ),
        "operator_id": req.operator_id,
        "created_at": req.created_at.isoformat(),
        "updated_at": req.updated_at.isoformat(),
        "history": [
            {
                "previous_status": h.previous_status,
                "new_status": h.new_status,
                "comment": h.comment,
                "is_internal": h.is_internal,
                "date": h.date.isoformat(),
                "operator": h.operator.first_name if h.operator else None,
            }
            for h in req.history
        ],
        "documents": [
            {"id": d.id, "filename": d.filename, "url": f"/uploads/{d.filename}"}
            for d in req.documents
        ],
    }


# ── Inbox ─────────────────────────────────────────────────────────────────────

@router.get("/inbox")
def get_inbox(
    request_type_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    current_user: Usuario = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    q = db.query(Solicitud).filter(
        Solicitud.status.in_([EstadoEnum.pending, EstadoEnum.in_progress])
    )
    if request_type_id:
        q = q.filter(Solicitud.request_type_id == request_type_id)
    if status_filter:
        q = q.filter(Solicitud.status == status_filter)
    if date_from:
        q = q.filter(Solicitud.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Solicitud.created_at <= datetime.fromisoformat(date_to))

    reqs = q.order_by(Solicitud.created_at.asc()).all()
    return [
        {
            "id": r.id,
            "ticket": r.ticket,
            "request_type": r.request_type.name,
            "status": r.status,
            "applicant_national_id": r.applicant_national_id,
            "user": f"{r.user.first_name} {r.user.last_name}" if r.user else r.applicant_national_id,
            "created_at": r.created_at.isoformat(),
            "operator_id": r.operator_id,
        }
        for r in reqs
    ]


# ── Open request ──────────────────────────────────────────────────────────────

@router.post("/requests/{id}/open")
def open_request(
    id: int,
    current_user: Usuario = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    req = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status == EstadoEnum.in_progress and req.operator_id != current_user.id:
        raise HTTPException(status_code=409, detail="Already being handled by another operator")

    previous = req.status
    req.status = EstadoEnum.in_progress
    req.operator_id = current_user.id
    req.updated_at = datetime.utcnow()

    db.add(HistorialEstado(
        request_id=req.id,
        operator_id=current_user.id,
        previous_status=previous,
        new_status=EstadoEnum.in_progress,
        comment=f"In progress by {req.operator.first_name}",
        is_internal=True,
    ))
    db.commit()
    return {"detail": "Request is now in progress"}


# ── Release request ───────────────────────────────────────────────────────────

@router.post("/requests/{id}/release")
def release_request(
    id: int,
    current_user: Usuario = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    req = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != EstadoEnum.in_progress:
        return {"detail": "Request was not in progress"}

    req.status = EstadoEnum.pending
    req.operator_id = None
    req.updated_at = datetime.utcnow()

    db.add(HistorialEstado(
        request_id=req.id,
        operator_id=current_user.id,
        previous_status=EstadoEnum.in_progress,
        new_status=EstadoEnum.pending,
        comment="Returned to pending",
        is_internal=True,
    ))
    db.commit()
    return {"detail": "Request returned to pending"}


# ── Action on request ─────────────────────────────────────────────────────────

class ActionBody(BaseModel):
    action: str  # approve | reject | escalate | comment
    comment: str | None = None
    is_internal: bool = False


ACTION_STATUS = {
    "approve": EstadoEnum.approved,
    "reject": EstadoEnum.rejected,
    "escalate": EstadoEnum.escalated,
}


@router.post("/requests/{id}/action")
def request_action(
    id: int,
    body: ActionBody,
    current_user: Usuario = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    req = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if body.action == "reject" and not body.comment:
        raise HTTPException(status_code=400, detail="Rejection requires a comment")

    if body.action == "comment":
        db.add(HistorialEstado(
            request_id=req.id,
            operator_id=current_user.id,
            previous_status=req.status,
            new_status=req.status,
            comment=body.comment,
            is_internal=body.is_internal,
        ))
        db.commit()
        return {"detail": "Comment added"}

    new_status = ACTION_STATUS.get(body.action)
    if not new_status:
        raise HTTPException(status_code=400, detail=f"Unknown action: {body.action}")

    previous = req.status
    req.status = new_status
    req.updated_at = datetime.utcnow()

    db.add(HistorialEstado(
        request_id=req.id,
        operator_id=current_user.id,
        previous_status=previous,
        new_status=new_status,
        comment=body.comment,
        is_internal=body.is_internal,
    ))

    if req.user_id and not body.is_internal:
        messages = {
            "approve": "Your request has been approved.",
            "reject": f"Your request was rejected. Reason: {body.comment}",
            "escalate": "Your request has been escalated to the coordinator for review.",
        }
        create_notification(db, req.user_id, req.id, messages.get(body.action, "Your request was updated."))

    db.commit()
    return {"detail": f"Request {body.action}d successfully"}


# ── Get full request ──────────────────────────────────────────────────────────

@router.get("/requests/{id}")
def get_request_operator(
    id: int,
    current_user: Usuario = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    req = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return _request_full(req)
