from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Documento(Base):
    __tablename__ = "documentos"

    id = Column(Integer, primary_key=True, index=True)
    solicitud_id = Column(Integer, ForeignKey("solicitudes.id"), nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    nombre_archivo = Column(String, nullable=False)
    ruta = Column(String, nullable=False)
    tipo_mime = Column(String, nullable=True)
    subido_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    solicitud = relationship("Solicitud", back_populates="documentos")
    usuario = relationship("Usuario", back_populates="documentos")
