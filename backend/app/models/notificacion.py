from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Notificacion(Base):
    __tablename__ = "notificaciones"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    request_id = Column(Integer, ForeignKey("solicitudes.id"), nullable=True)
    message = Column(String, nullable=False)
    read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("Usuario", back_populates="notifications")
    request = relationship("Solicitud", back_populates="notifications")
