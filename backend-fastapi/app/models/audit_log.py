from datetime import datetime
from sqlalchemy import Column, BigInteger, String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.base import Base

class LogAuditoria(Base):
    __tablename__ = "logs_auditoria"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    data_hora = Column(DateTime, nullable=False, default=datetime.utcnow)
    usuario_id = Column(UUID(as_uuid=True), nullable=True)
    acao = Column(String(255), nullable=False)
    alvo = Column(String(255), nullable=True)
    detalhes = Column(JSONB, nullable=True)
