from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Documento(Base):
    __tablename__ = "documentos"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("solicitudes.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    filename = Column(String, nullable=False)
    path = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    request = relationship("Solicitud", back_populates="documents")
    user = relationship("Usuario", back_populates="documents")
