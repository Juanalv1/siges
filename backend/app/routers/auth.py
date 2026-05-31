from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.usuario import PreguntaSeguridad, RespuestaSeguridad, RolEnum, Usuario
from app.services.sogac import verificar_estudiante
from app.utils.security import (
    create_access_token,
    decode_token,
    hash_password,
    hash_respuesta,
    verify_password,
    verify_respuesta,
)

router = APIRouter(prefix="/auth", tags=["auth"])

PREGUNTAS_SEED = [
    "¿Nombre de tu primera mascota?",
    "¿Ciudad donde naciste?",
    "¿Nombre de tu escuela primaria?",
    "¿Apodo de infancia?",
    "¿Película favorita de la infancia?",
]


def seed_preguntas(db: Session):
    if db.query(PreguntaSeguridad).count() == 0:
        for p in PREGUNTAS_SEED:
            db.add(PreguntaSeguridad(pregunta=p))
        db.commit()


# ── Schemas ──────────────────────────────────────────────────────────────────

class RespuestaItem(BaseModel):
    pregunta_id: int
    respuesta: str


class RegisterBody(BaseModel):
    cedula: str
    nombre: str
    apellido: str
    correo: str
    telefono: str | None = None
    password: str
    preguntas: list[RespuestaItem]


class LoginBody(BaseModel):
    correo: str
    password: str


class RecuperarIniciarBody(BaseModel):
    cedula: str


class RecuperarVerificarBody(BaseModel):
    cedula: str
    respuestas: list[RespuestaItem]


class NuevaPasswordBody(BaseModel):
    nueva_password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/preguntas-seguridad")
def get_preguntas(db: Session = Depends(get_db)):
    seed_preguntas(db)
    preguntas = db.query(PreguntaSeguridad).all()
    return [{"id": p.id, "pregunta": p.pregunta} for p in preguntas]


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterBody, db: Session = Depends(get_db)):
    seed_preguntas(db)

    if not verificar_estudiante(body.cedula):
        raise HTTPException(status_code=400, detail="Cédula no encontrada en el sistema")

    if db.query(Usuario).filter(Usuario.cedula == body.cedula).first():
        raise HTTPException(status_code=400, detail="La cédula ya está registrada")

    if db.query(Usuario).filter(Usuario.correo == body.correo).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    if len(body.preguntas) != 2:
        raise HTTPException(status_code=400, detail="Se requieren exactamente 2 preguntas de seguridad")

    usuario = Usuario(
        cedula=body.cedula,
        nombre=body.nombre,
        apellido=body.apellido,
        correo=body.correo,
        telefono=body.telefono,
        password_hash=hash_password(body.password),
        rol=RolEnum.estudiante,
        activo=True,
    )
    db.add(usuario)
    db.flush()

    for item in body.preguntas:
        pregunta = db.query(PreguntaSeguridad).filter(PreguntaSeguridad.id == item.pregunta_id).first()
        if not pregunta:
            raise HTTPException(status_code=400, detail=f"Pregunta {item.pregunta_id} no existe")
        db.add(RespuestaSeguridad(
            usuario_id=usuario.id,
            pregunta_id=item.pregunta_id,
            respuesta_hash=hash_respuesta(item.respuesta),
        ))

    db.commit()
    db.refresh(usuario)
    return {"id": usuario.id, "nombre": usuario.nombre, "correo": usuario.correo}


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.correo == body.correo).first()
    if not usuario or not verify_password(body.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not usuario.activo:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")

    token = create_access_token(
        {"sub": usuario.id, "rol": usuario.rol, "nombre": usuario.nombre, "scope": "access"},
        timedelta(minutes=480),
    )
    return {"access_token": token, "token_type": "bearer"}


@router.post("/recuperar/iniciar")
def recuperar_iniciar(body: RecuperarIniciarBody, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.cedula == body.cedula).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Cédula no encontrada")

    respuestas = db.query(RespuestaSeguridad).filter(RespuestaSeguridad.usuario_id == usuario.id).all()
    return {
        "preguntas": [
            {"pregunta_id": r.pregunta_id, "pregunta": r.pregunta.pregunta}
            for r in respuestas
        ]
    }


@router.post("/recuperar/verificar")
def recuperar_verificar(body: RecuperarVerificarBody, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.cedula == body.cedula).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Cédula no encontrada")

    for item in body.respuestas:
        rs = db.query(RespuestaSeguridad).filter(
            RespuestaSeguridad.usuario_id == usuario.id,
            RespuestaSeguridad.pregunta_id == item.pregunta_id,
        ).first()
        if not rs or not verify_respuesta(item.respuesta, rs.respuesta_hash):
            raise HTTPException(status_code=400, detail="Respuestas incorrectas")

    token = create_access_token(
        {"sub": usuario.id, "scope": "recovery"},
        timedelta(minutes=15),
    )
    return {"recovery_token": token}


@router.post("/recuperar/nueva-password")
def nueva_password(body: NuevaPasswordBody, db: Session = Depends(get_db), token: str = Depends(lambda: None)):
    from fastapi import Header
    raise HTTPException(status_code=501, detail="Usar el endpoint con header Authorization")


from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer()

@router.post("/recuperar/cambiar-password")
def cambiar_password(
    body: NuevaPasswordBody,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
):
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    if payload.get("scope") != "recovery":
        raise HTTPException(status_code=401, detail="Token no es de recuperación")

    usuario = db.query(Usuario).filter(Usuario.id == payload.get("sub")).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.password_hash = hash_password(body.nueva_password)
    db.commit()
    return {"detail": "Contraseña actualizada correctamente"}
