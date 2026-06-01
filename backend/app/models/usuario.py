import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class RolEnum(str, enum.Enum):
    student = "student"
    operator = "operator"
    coordinator = "coordinator"


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    national_id = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(RolEnum), default=RolEnum.student, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    security_answers = relationship("RespuestaSeguridad", back_populates="user")
    requests = relationship("Solicitud", foreign_keys="Solicitud.user_id", back_populates="user")
    notifications = relationship("Notificacion", back_populates="user")
    documents = relationship("Documento", back_populates="user")


class PreguntaSeguridad(Base):
    __tablename__ = "preguntas_seguridad"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)

    answers = relationship("RespuestaSeguridad", back_populates="question_obj")


class RespuestaSeguridad(Base):
    __tablename__ = "respuestas_seguridad"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("preguntas_seguridad.id"), nullable=False)
    answer_hash = Column(String, nullable=False)

    user = relationship("Usuario", back_populates="security_answers")
    question_obj = relationship("PreguntaSeguridad", back_populates="answers")
