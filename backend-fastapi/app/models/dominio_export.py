import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class DominioExport(Base):
    """Um lote de envio de rubricas para uma competência de um cliente.
    Estados em app.enums.dominio.DominioExportStatus."""

    __tablename__ = "dominio_exports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    competence = Column(Date, nullable=False)  # sempre o 1º dia do mês
    status = Column(String(20), nullable=False, default="DRAFT")  # DominioExportStatus

    created_by = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    total_items = Column(Integer, nullable=False, default=0)
    success_items = Column(Integer, nullable=False, default=0)
    failed_items = Column(Integer, nullable=False, default=0)
