import uuid
import secrets
from datetime import datetime, timedelta
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

def generate_token():
    return secrets.token_urlsafe(32)

def default_expiration():
    return datetime.utcnow() + timedelta(days=30)

class ClientToken(Base):
    __tablename__ = "client_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(100), nullable=False, unique=True, default=generate_token)
    data_expiracao = Column(DateTime, nullable=False, default=default_expiration)
    ativo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
