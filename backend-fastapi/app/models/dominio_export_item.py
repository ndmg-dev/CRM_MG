import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, ARRAY, DATE
from app.db.base import Base


class DominioExportItem(Base):
    """Um lançamento de rubrica dentro de um export — um por (colaborador,
    tipo de evento). `request_fingerprint` é o SHA-256 de tudo que compõe o
    payload (INTEGRACAO_DOMINIO_FOLHA_API.md §13): usado pra não reenviar
    automaticamente o mesmo lançamento já aceito."""

    __tablename__ = "dominio_export_items"
    __table_args__ = (
        Index("ix_dominio_export_items_fingerprint", "request_fingerprint"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    export_id = Column(UUID(as_uuid=True), ForeignKey("dominio_exports.id", ondelete="CASCADE"), nullable=False)

    employee_id = Column(String(50), nullable=False)
    cpf_masked = Column(String(20), nullable=True)
    internal_event_type = Column(String(30), nullable=False)  # PayrollEventType
    payslip_item_code = Column(Integer, nullable=False)
    reference = Column(Numeric(8, 4), nullable=False)
    operation_type = Column(String(10), nullable=False, default="INSERT")  # OperationType
    missed_days = Column(ARRAY(DATE), nullable=True)

    request_fingerprint = Column(String(64), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")  # DominioExportItemStatus
    http_status = Column(Integer, nullable=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    error_code = Column(String(50), nullable=True)
    error_message = Column(String(500), nullable=True)
    sent_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
