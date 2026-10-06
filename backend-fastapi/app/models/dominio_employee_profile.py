import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Date, DateTime, Boolean, ForeignKey, LargeBinary, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class DominioEmployeeProfile(Base):
    """Dados do colaborador exigidos pela API do Domínio que o PDF do
    espelho de ponto não traz (CPF, categoria eSocial, admissão).
    `employee_id` é o identificador do colaborador no Processar Ponto
    (matrícula do relógio) — não há cadastro de funcionário no backend do
    CRM_MG hoje, então este perfil é o cadastro complementar mínimo,
    por cliente (INTEGRACAO_DOMINIO_FOLHA_API.md §9)."""

    __tablename__ = "dominio_employee_profiles"
    __table_args__ = (UniqueConstraint("cliente_id", "employee_id", name="uq_dominio_employee_cliente_matricula"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String(50), nullable=False)

    cpf_encrypted = Column(LargeBinary, nullable=True)
    cpf_masked = Column(String(20), nullable=True)
    esocial_category_code = Column(Integer, nullable=True)
    admission_date = Column(Date, nullable=True)
    esocial_code = Column(String(30), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
