"""Tabela de vínculo manual CNPJ -> cliente (extratos órfãos)

Override que o setor contábil cria pela tela para vincular um extrato cujo CNPJ
não casa com nenhum `clientes.cnpj`. O ingest passa a consultar esta tabela
além de `clientes`, então o vínculo sobrevive a reenvios do n8n.

Revision ID: c3d9e1f2a4b6
Revises: a1f4c0d2e5b7
Create Date: 2026-10-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c3d9e1f2a4b6"
down_revision = "a1f4c0d2e5b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "extrato_cnpj_vinculos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cnpj", sa.String(14), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("cnpj", name="uq_extrato_cnpj_vinculos_cnpj"),
    )
    op.create_index("ix_extrato_cnpj_vinculos_cnpj", "extrato_cnpj_vinculos", ["cnpj"])
    op.create_index("ix_extrato_cnpj_vinculos_client_id", "extrato_cnpj_vinculos", ["client_id"])


def downgrade() -> None:
    op.drop_index("ix_extrato_cnpj_vinculos_client_id", table_name="extrato_cnpj_vinculos")
    op.drop_index("ix_extrato_cnpj_vinculos_cnpj", table_name="extrato_cnpj_vinculos")
    op.drop_table("extrato_cnpj_vinculos")
