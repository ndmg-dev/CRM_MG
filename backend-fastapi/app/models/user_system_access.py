from datetime import datetime
from sqlalchemy import Column, BigInteger, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class UsuarioSistemaAcesso(Base):
    __tablename__ = "usuario_sistema_acessos"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    sistema_id = Column(UUID(as_uuid=True), ForeignKey("sistemas.id", ondelete="CASCADE"), nullable=False)
    granted_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    granted_by = Column(UUID(as_uuid=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("usuario_id", "sistema_id", name="uk_usuario_sistema"),
    )
