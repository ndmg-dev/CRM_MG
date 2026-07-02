import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    razao_social = Column(String(255), nullable=False)
    nome_fantasia = Column(String(255), nullable=True)
    cnpj = Column(String(14), nullable=False, unique=True)
    regime_tributario = Column(String(50), nullable=True)
    status_cnpj = Column(String(100), nullable=True)
    contato_principal = Column(String(255), nullable=True)
    telefone_whatsapp = Column(String(20), nullable=True)
    documentos_exigidos = Column(String, nullable=True) # Text column for comma separated or newline separated rules
    data_criacao = Column(DateTime, nullable=False, default=datetime.utcnow)
    data_atualizacao = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
