import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class RolEnum(str, enum.Enum):
    estudiante = "estudiante"
    operador = "operador"
    coordinador = "coordinador"


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    cedula = Column(String, unique=True, index=True, nullable=False)
    nombre = Column(String, nullable=False)
    apellido = Column(String, nullable=False)
    correo = Column(String, unique=True, index=True, nullable=False)
    telefono = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    rol = Column(Enum(RolEnum), default=RolEnum.estudiante, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    respuestas_seguridad = relationship("RespuestaSeguridad", back_populates="usuario")
    solicitudes = relationship("Solicitud", foreign_keys="Solicitud.usuario_id", back_populates="usuario")
    notificaciones = relationship("Notificacion", back_populates="usuario")
    documentos = relationship("Documento", back_populates="usuario")


class PreguntaSeguridad(Base):
    __tablename__ = "preguntas_seguridad"

    id = Column(Integer, primary_key=True, index=True)
    pregunta = Column(String, nullable=False)

    respuestas = relationship("RespuestaSeguridad", back_populates="pregunta")


class RespuestaSeguridad(Base):
    __tablename__ = "respuestas_seguridad"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    pregunta_id = Column(Integer, ForeignKey("preguntas_seguridad.id"), nullable=False)
    respuesta_hash = Column(String, nullable=False)

    usuario = relationship("Usuario", back_populates="respuestas_seguridad")
    pregunta = relationship("PreguntaSeguridad", back_populates="respuestas")
