import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class ExtratoProcessado(Base):
    """Espelho somente-leitura de um extrato bancário já processado pelo n8n
    (dataTable `extratos_processados`). A fonte da verdade continua no n8n e no
    Drive; aqui guardamos só a cópia consultável.

    Resolvido contra `clientes` por CNPJ: achou -> `client_id` + `vinculado`
    True; não achou -> `client_id` None + `vinculado` False (o dashboard
    separa esses no balde "não vinculados"). Nunca criamos cliente a partir do
    n8n.
    """

    __tablename__ = "extratos_processados"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Nullable: um CNPJ sem cliente correspondente entra com client_id None e
    # vinculado=False, em vez de quebrar a ingestão.
    client_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True, index=True)
    # CNPJ só dígitos (14), fallback quando client_id é None (conciliação).
    cnpj = Column(String(14), nullable=False, index=True)
    ano = Column(Integer, nullable=False)
    mes = Column(Integer, nullable=False)
    # = idempotency_key (SHA-256 do PDF calculado pelo n8n). Trava anti-duplicidade.
    sha256 = Column(String(64), nullable=False, unique=True)
    arquivo_origem = Column(String(255), nullable=True)
    drive_file_id = Column(String(255), nullable=True)
    drive_url = Column(String(1024), nullable=True)
    # Conta bancária do extrato (dataTable `contas_bancarias`): guardada inline,
    # sem tabela própria (ver decisão em aberto no plano).
    agencia = Column(String(20), nullable=True)
    conta = Column(String(30), nullable=True)
    banco = Column(String(100), nullable=True)
    processado_em = Column(DateTime, nullable=True)
    # False = CNPJ sem cliente -> sinaliza no dashboard para conciliação manual.
    vinculado = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
