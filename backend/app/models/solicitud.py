import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class EstadoEnum(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"
    resolved = "resolved"


class Solicitud(Base):
    __tablename__ = "solicitudes"

    id = Column(Integer, primary_key=True, index=True)
    ticket = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    applicant_national_id = Column(String, nullable=True)
    request_type_id = Column(Integer, ForeignKey("tipos_tramite.id"), nullable=False)
    status = Column(Enum(EstadoEnum), default=EstadoEnum.pending, nullable=False)
    operator_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("Usuario", foreign_keys=[user_id], back_populates="requests")
    operator = relationship("Usuario", foreign_keys=[operator_id])
    request_type = relationship("TipoTramite", back_populates="requests")
    history = relationship("HistorialEstado", back_populates="request", order_by="HistorialEstado.date")
    documents = relationship("Documento", back_populates="request")
    notifications = relationship("Notificacion", back_populates="request")


class HistorialEstado(Base):
    __tablename__ = "historial_estados"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("solicitudes.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=False)
    comment = Column(String, nullable=True)
    is_internal = Column(Boolean, default=False, nullable=False)
    date = Column(DateTime, default=datetime.utcnow, nullable=False)

    request = relationship("Solicitud", back_populates="history")
    operator = relationship("Usuario", foreign_keys=[operator_id])
