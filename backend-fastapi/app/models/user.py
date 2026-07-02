import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    perfil = Column(String(50), nullable=False)
    setor = Column(String(50), nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    foto_perfil = Column(String(1024), nullable=True)
    data_criacao = Column(DateTime, nullable=False, default=datetime.utcnow)
