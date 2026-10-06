import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class DominioRubricMapping(Base):
    """De-para por cliente: qual código de rubrica do Domínio corresponde a
    cada tipo de evento interno do Processar Ponto. Os códigos de rubrica
    variam por empresa-cliente no Domínio — nunca fixo no código
    (INTEGRACAO_DOMINIO_FOLHA_API.md §8)."""

    __tablename__ = "dominio_rubric_mappings"
    __table_args__ = (UniqueConstraint("cliente_id", "internal_event_type", name="uq_dominio_rubric_cliente_evento"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)

    internal_event_type = Column(String(30), nullable=False)  # PayrollEventType
    payslip_item_code = Column(Integer, nullable=False)
    description = Column(String(255), nullable=True)
    unit = Column(String(20), nullable=False)  # PayslipItemUnit
    enabled = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
