from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.usuario import PreguntaSeguridad, RespuestaSeguridad, RolEnum, Usuario
from app.services.sogac import verify_student
from app.utils.security import (
    create_access_token,
    decode_token,
    hash_answer,
    hash_password,
    verify_answer,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

SECURITY_QUESTIONS_SEED = [
    "¿Nombre de tu primera mascota?",
    "¿Ciudad donde naciste?",
    "¿Nombre de tu escuela primaria?",
    "¿Apodo de infancia?",
    "¿Película favorita de la infancia?",
]


def seed_questions(db: Session):
    if db.query(PreguntaSeguridad).count() == 0:
        for q in SECURITY_QUESTIONS_SEED:
            db.add(PreguntaSeguridad(question=q))
        db.commit()


# ── Schemas ──────────────────────────────────────────────────────────────────

class SecurityQuestionItem(BaseModel):
    question_id: int
    answer: str


class RegisterBody(BaseModel):
    national_id: str
    first_name: str
    last_name: str
    email: str
    phone: str | None = None
    password: str
    security_questions: list[SecurityQuestionItem]


class LoginBody(BaseModel):
    email: str
    password: str


class RecoverStartBody(BaseModel):
    national_id: str


class RecoverVerifyBody(BaseModel):
    national_id: str
    answers: list[SecurityQuestionItem]


class ChangePasswordBody(BaseModel):
    new_password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/security-questions")
def get_security_questions(db: Session = Depends(get_db)):
    seed_questions(db)
    questions = db.query(PreguntaSeguridad).all()
    return [{"id": q.id, "question": q.question} for q in questions]


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterBody, db: Session = Depends(get_db)):
    seed_questions(db)

    if not verify_student(body.national_id):
        raise HTTPException(status_code=400, detail="National ID not found in the system")

    if db.query(Usuario).filter(Usuario.national_id == body.national_id).first():
        raise HTTPException(status_code=400, detail="National ID already registered")

    if db.query(Usuario).filter(Usuario.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(body.security_questions) != 2:
        raise HTTPException(status_code=400, detail="Exactly 2 security questions are required")

    user = Usuario(
        national_id=body.national_id,
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=RolEnum.student,
        active=True,
    )
    db.add(user)
    db.flush()

    for item in body.security_questions:
        question = db.query(PreguntaSeguridad).filter(PreguntaSeguridad.id == item.question_id).first()
        if not question:
            raise HTTPException(status_code=400, detail=f"Question {item.question_id} does not exist")
        db.add(RespuestaSeguridad(
            user_id=user.id,
            question_id=item.question_id,
            answer_hash=hash_answer(item.answer),
        ))

    db.commit()
    db.refresh(user)
    return {"id": user.id, "first_name": user.first_name, "email": user.email}


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token(
        {"sub": user.id, "role": user.role, "name": user.first_name, "scope": "access"},
        timedelta(minutes=480),
    )
    return {"access_token": token, "token_type": "bearer"}


@router.post("/recover/start")
def recover_start(body: RecoverStartBody, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.national_id == body.national_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="National ID not found")

    answers = db.query(RespuestaSeguridad).filter(RespuestaSeguridad.user_id == user.id).all()
    return {
        "questions": [
            {"question_id": a.question_id, "question": a.question_obj.question}
            for a in answers
        ]
    }


@router.post("/recover/verify")
def recover_verify(body: RecoverVerifyBody, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.national_id == body.national_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="National ID not found")

    for item in body.answers:
        stored = db.query(RespuestaSeguridad).filter(
            RespuestaSeguridad.user_id == user.id,
            RespuestaSeguridad.question_id == item.question_id,
        ).first()
        if not stored or not verify_answer(item.answer, stored.answer_hash):
            raise HTTPException(status_code=400, detail="Incorrect answers")

    token = create_access_token(
        {"sub": user.id, "scope": "recovery"},
        timedelta(minutes=15),
    )
    return {"recovery_token": token}


from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer()


@router.post("/recover/change-password")
def change_password(
    body: ChangePasswordBody,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
):
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("scope") != "recovery":
        raise HTTPException(status_code=401, detail="Token is not a recovery token")

    user = db.query(Usuario).filter(Usuario.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"detail": "Password updated successfully"}
