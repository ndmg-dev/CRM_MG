import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class Tarefa(Base):
    __tablename__ = "tarefas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    titulo = Column(String(255), nullable=False)
    descricao = Column(Text, nullable=True)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True)
    responsavel_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    setor_origem = Column(String(50), nullable=True)
    status = Column(String(50), nullable=False, default="PENDENTE")
    prioridade = Column(String(50), nullable=False, default="MEDIA")
    data_vencimento = Column(DateTime, nullable=True)
    data_conclusao = Column(DateTime, nullable=True)
    data_criacao = Column(DateTime, nullable=False, default=datetime.utcnow)
    data_atualizacao = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
