import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class VinculoCnpjExtrato(Base):
    """Override manual de CNPJ -> cliente para extratos órfãos.

    Quando o CNPJ de um extrato não casa com nenhum `clientes.cnpj` (grafia
    diferente, filial, cadastro ausente), o setor contábil vincula o extrato a
    um cliente pela tela. Esse vínculo fica aqui para que a resolução sobreviva
    a reenvios do n8n: o ingest consulta primeiro `clientes.cnpj` e, se não
    achar, esta tabela. Sem isso, cada reingestão do mesmo PDF desfaria o
    vínculo (o CNPJ continua não batendo em `clientes`).
    """

    __tablename__ = "extrato_cnpj_vinculos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # CNPJ do extrato (só dígitos). Um CNPJ -> um cliente.
    cnpj = Column(String(14), nullable=False, unique=True, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
