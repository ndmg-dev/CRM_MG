import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class ConsolidadoSocioAno(Base):
    """Totais anuais de retiradas/aportes por sócio de uma empresa.

    Derivado no backend (não é espelho de dataTable): recalculado a partir das
    `movimentacoes_socios` do ano a cada ingestão, nunca confiando no total
    pré-somado do payload (que poderia divergir). Só existe para extratos
    vinculados a um cliente — por isso `client_id` é obrigatório.
    """

    __tablename__ = "consolidados_socio_ano"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, index=True)
    socio = Column(String(255), nullable=False)
    ano = Column(Integer, nullable=False)
    total_retiradas = Column(Numeric(14, 2), nullable=False, default=0)
    total_aportes = Column(Numeric(14, 2), nullable=False, default=0)
    atualizado_em = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("client_id", "socio", "ano", name="uq_consolidado_cliente_socio_ano"),
    )
