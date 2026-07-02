import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class Sistema(Base):
    __tablename__ = "sistemas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(255), nullable=False)
    descricao = Column(String(1024), nullable=True)
    slug = Column(String(255), nullable=False, unique=True)
    categoria = Column(String(50), nullable=False)
    setor = Column(String(50), nullable=True)
    url = Column(String(1024), nullable=True)
    icone = Column(String(255), nullable=True)
    allowed_origin = Column(String(1024), nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
