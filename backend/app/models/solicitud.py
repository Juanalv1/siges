import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class EstadoEnum(str, enum.Enum):
    pendiente = "pendiente"
    en_atencion = "en_atencion"
    aprobada = "aprobada"
    rechazada = "rechazada"
    escalada = "escalada"
    resuelta = "resuelta"


class Solicitud(Base):
    __tablename__ = "solicitudes"

    id = Column(Integer, primary_key=True, index=True)
    ticket = Column(String, unique=True, index=True, nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    cedula_solicitante = Column(String, nullable=True)
    tipo_tramite_id = Column(Integer, ForeignKey("tipos_tramite.id"), nullable=False)
    estado = Column(Enum(EstadoEnum), default=EstadoEnum.pendiente, nullable=False)
    operador_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    descripcion = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    usuario = relationship("Usuario", foreign_keys=[usuario_id], back_populates="solicitudes")
    operador = relationship("Usuario", foreign_keys=[operador_id])
    tipo_tramite = relationship("TipoTramite", back_populates="solicitudes")
    historial = relationship("HistorialEstado", back_populates="solicitud", order_by="HistorialEstado.fecha")
    documentos = relationship("Documento", back_populates="solicitud")
    notificaciones = relationship("Notificacion", back_populates="solicitud")


class HistorialEstado(Base):
    __tablename__ = "historial_estados"

    id = Column(Integer, primary_key=True, index=True)
    solicitud_id = Column(Integer, ForeignKey("solicitudes.id"), nullable=False)
    operador_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    estado_anterior = Column(String, nullable=True)
    estado_nuevo = Column(String, nullable=False)
    comentario = Column(String, nullable=True)
    es_interno = Column(Boolean, default=False, nullable=False)
    fecha = Column(DateTime, default=datetime.utcnow, nullable=False)

    solicitud = relationship("Solicitud", back_populates="historial")
    operador = relationship("Usuario", foreign_keys=[operador_id])
