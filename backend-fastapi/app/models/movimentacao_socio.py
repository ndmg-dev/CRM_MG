import uuid
from datetime import datetime
from sqlalchemy import Column, String, Date, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class MovimentacaoSocio(Base):
    """Uma linha de movimentação de sócio (retirada/aporte) de um extrato.
    Espelho 1:1 da dataTable `movimentacoes_socios` do n8n.

    As movimentações de um extrato são substituídas por inteiro (delete+insert
    por `extrato_id`) a cada reenvio do mesmo PDF — ver extrato_ingest_service.
    O `tipo` guarda o valor do enum TipoMovimentacao ("retirada"/"aporte").
    """

    __tablename__ = "movimentacoes_socios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    extrato_id = Column(UUID(as_uuid=True), ForeignKey("extratos_processados.id", ondelete="CASCADE"), nullable=False, index=True)
    # Herdado do extrato: None quando o CNPJ não casou com nenhum cliente.
    client_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True, index=True)
    socio = Column(String(255), nullable=False)
    cpf = Column(String(11), nullable=True)
    data = Column(Date, nullable=True)
    tipo = Column(String(10), nullable=False)  # TipoMovimentacao
    valor = Column(Numeric(14, 2), nullable=False)
    descricao = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
