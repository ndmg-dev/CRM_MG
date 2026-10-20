"""Tabelas espelho do módulo Extratos de Sócios (ingestão n8n -> CRM)

Três tabelas: `extratos_processados` (espelho do extrato processado),
`movimentacoes_socios` (linhas de sócios) e `consolidados_socio_ano` (totais
anuais recalculados no backend). Resolvidas contra `clientes` por CNPJ, nunca
duplicando empresa. Idempotência garantida pelo unique em
`extratos_processados.sha256`.

Revision ID: a1f4c0d2e5b7
Revises: 2136b6331d55
Create Date: 2026-10-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a1f4c0d2e5b7"
down_revision = "2136b6331d55"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "extratos_processados",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("cnpj", sa.String(14), nullable=False),
        sa.Column("ano", sa.Integer(), nullable=False),
        sa.Column("mes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("arquivo_origem", sa.String(255), nullable=True),
        sa.Column("drive_file_id", sa.String(255), nullable=True),
        sa.Column("drive_url", sa.String(1024), nullable=True),
        sa.Column("agencia", sa.String(20), nullable=True),
        sa.Column("conta", sa.String(30), nullable=True),
        sa.Column("banco", sa.String(100), nullable=True),
        sa.Column("processado_em", sa.DateTime(), nullable=True),
        sa.Column("vinculado", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("sha256", name="uq_extratos_processados_sha256"),
    )
    op.create_index("ix_extratos_processados_client_id", "extratos_processados", ["client_id"])
    op.create_index("ix_extratos_processados_cnpj", "extratos_processados", ["cnpj"])

    op.create_table(
        "movimentacoes_socios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("extrato_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("extratos_processados.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("socio", sa.String(255), nullable=False),
        sa.Column("cpf", sa.String(11), nullable=True),
        sa.Column("data", sa.Date(), nullable=True),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("valor", sa.Numeric(14, 2), nullable=False),
        sa.Column("descricao", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_movimentacoes_socios_extrato_id", "movimentacoes_socios", ["extrato_id"])
    op.create_index("ix_movimentacoes_socios_client_id", "movimentacoes_socios", ["client_id"])

    op.create_table(
        "consolidados_socio_ano",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("socio", sa.String(255), nullable=False),
        sa.Column("ano", sa.Integer(), nullable=False),
        sa.Column("total_retiradas", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_aportes", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("atualizado_em", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("client_id", "socio", "ano", name="uq_consolidado_cliente_socio_ano"),
    )
    op.create_index("ix_consolidados_socio_ano_client_id", "consolidados_socio_ano", ["client_id"])


def downgrade() -> None:
    op.drop_index("ix_consolidados_socio_ano_client_id", table_name="consolidados_socio_ano")
    op.drop_table("consolidados_socio_ano")
    op.drop_index("ix_movimentacoes_socios_client_id", table_name="movimentacoes_socios")
    op.drop_index("ix_movimentacoes_socios_extrato_id", table_name="movimentacoes_socios")
    op.drop_table("movimentacoes_socios")
    op.drop_index("ix_extratos_processados_cnpj", table_name="extratos_processados")
    op.drop_index("ix_extratos_processados_client_id", table_name="extratos_processados")
    op.drop_table("extratos_processados")
