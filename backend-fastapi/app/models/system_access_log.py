from datetime import datetime
from sqlalchemy import Column, BigInteger, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class SystemAccessLog(Base):
    __tablename__ = "system_access_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    sistema_id = Column(UUID(as_uuid=True), ForeignKey("sistemas.id"), nullable=False)
    inicio = Column(DateTime, nullable=False, default=datetime.utcnow)
    fim = Column(DateTime, nullable=True)
    duracao_segundos = Column(Integer, nullable=True)
