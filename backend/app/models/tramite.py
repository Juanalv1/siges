from sqlalchemy import JSON, Boolean, Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class TipoTramite(Base):
    __tablename__ = "tipos_tramite"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    required_docs = Column(JSON, default=list, nullable=False)
    deadline_days = Column(Integer, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    requires_account = Column(Boolean, default=True, nullable=False)

    requests = relationship("Solicitud", back_populates="request_type")
