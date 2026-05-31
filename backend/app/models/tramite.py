from sqlalchemy import JSON, Boolean, Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class TipoTramite(Base):
    __tablename__ = "tipos_tramite"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    docs_requeridos = Column(JSON, default=list, nullable=False)
    dias_limite = Column(Integer, nullable=True)
    activo = Column(Boolean, default=True, nullable=False)
    requiere_cuenta = Column(Boolean, default=True, nullable=False)

    solicitudes = relationship("Solicitud", back_populates="tipo_tramite")
