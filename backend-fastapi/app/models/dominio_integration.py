import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class DominioIntegration(Base):
    """Uma por cliente (empresa) — guarda a chave de integração Onvio já
    ativada (cifrada) e os dados que a ativação devolve, só para conferência
    visual na tela de configuração (nunca re-enviados para o Domínio)."""

    __tablename__ = "dominio_integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Chave fornecida pelo contador/cliente, só usada para chamar o endpoint
    # de ativação. Apagada (setada para None) depois que integration_key é
    # gerada com sucesso — não há motivo para guardá-la depois disso.
    activation_key_encrypted = Column(LargeBinary, nullable=True)
    # Chave definitiva devolvida pela ativação — é ela que vai no header
    # Integration-Key de todo envio. Nunca a activation_key original.
    integration_key_encrypted = Column(LargeBinary, nullable=True)

    accounting_office_name = Column(String(255), nullable=True)
    client_name = Column(String(255), nullable=True)
    client_document = Column(String(20), nullable=True)

    hours_format = Column(String(20), nullable=True)  # HoursFormat
    enabled = Column(Boolean, nullable=False, default=False)

    validated_at = Column(DateTime, nullable=True)
    activated_at = Column(DateTime, nullable=True)
    last_connection_test_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
