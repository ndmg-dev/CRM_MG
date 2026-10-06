"""Tabelas da integração Processar Ponto -> Domínio Folha (Onvio API)

Esta é a primeira migration Alembic de verdade do projeto — até aqui o
schema era criado só por `Base.metadata.create_all` no startup (sem
versionamento, sem suporte a ALTER TABLE em produção). Essas tabelas
guardam credencial cifrada e precisam evoluir com segurança ao longo do
tempo, então passam a ser o primeiro ponto gerenciado por Alembic.

Revision ID: 2136b6331d55
Revises:
Create Date: 2026-10-05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "2136b6331d55"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dominio_integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cliente_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("activation_key_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("integration_key_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("accounting_office_name", sa.String(255), nullable=True),
        sa.Column("client_name", sa.String(255), nullable=True),
        sa.Column("client_document", sa.String(20), nullable=True),
        sa.Column("hours_format", sa.String(20), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("validated_at", sa.DateTime(), nullable=True),
        sa.Column("activated_at", sa.DateTime(), nullable=True),
        sa.Column("last_connection_test_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "dominio_rubric_mappings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cliente_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("internal_event_type", sa.String(30), nullable=False),
        sa.Column("payslip_item_code", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("cliente_id", "internal_event_type", name="uq_dominio_rubric_cliente_evento"),
    )

    op.create_table(
        "dominio_employee_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cliente_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", sa.String(50), nullable=False),
        sa.Column("cpf_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("cpf_masked", sa.String(20), nullable=True),
        sa.Column("esocial_category_code", sa.Integer(), nullable=True),
        sa.Column("admission_date", sa.Date(), nullable=True),
        sa.Column("esocial_code", sa.String(30), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("cliente_id", "employee_id", name="uq_dominio_employee_cliente_matricula"),
    )

    op.create_table(
        "dominio_exports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cliente_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("competence", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("total_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_items", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "dominio_export_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("export_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dominio_exports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", sa.String(50), nullable=False),
        sa.Column("cpf_masked", sa.String(20), nullable=True),
        sa.Column("internal_event_type", sa.String(30), nullable=False),
        sa.Column("payslip_item_code", sa.Integer(), nullable=False),
        sa.Column("reference", sa.Numeric(8, 4), nullable=False),
        sa.Column("operation_type", sa.String(10), nullable=False, server_default="INSERT"),
        sa.Column("missed_days", postgresql.ARRAY(sa.Date()), nullable=True),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_code", sa.String(50), nullable=True),
        sa.Column("error_message", sa.String(500), nullable=True),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_dominio_export_items_fingerprint", "dominio_export_items", ["request_fingerprint"])


def downgrade() -> None:
    op.drop_index("ix_dominio_export_items_fingerprint", table_name="dominio_export_items")
    op.drop_table("dominio_export_items")
    op.drop_table("dominio_exports")
    op.drop_table("dominio_employee_profiles")
    op.drop_table("dominio_rubric_mappings")
    op.drop_table("dominio_integrations")
