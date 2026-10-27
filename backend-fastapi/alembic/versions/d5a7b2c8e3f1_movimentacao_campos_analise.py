"""Campos opcionais de análise em movimentacoes_socios

Espelham as colunas do relatório "Transações Identificadas" do n8n
(nome no extrato, contraparte, papel, documento, histórico). Todos nullable —
compatível com o payload atual. ADD COLUMN IF NOT EXISTS para ser idempotente
(o schema deste projeto é criado por create_all; a migração pode rodar depois
de um ALTER manual sem quebrar).

Revision ID: d5a7b2c8e3f1
Revises: c3d9e1f2a4b6
Create Date: 2026-10-27
"""

from alembic import op

revision = "d5a7b2c8e3f1"
down_revision = "c3d9e1f2a4b6"
branch_labels = None
depends_on = None

_COLS = [
    ("nome_extrato", "VARCHAR(255)"),
    ("contraparte", "VARCHAR(255)"),
    ("papel", "VARCHAR(30)"),
    ("documento", "VARCHAR(100)"),
    ("historico", "VARCHAR(255)"),
]


def upgrade() -> None:
    for nome, tipo in _COLS:
        op.execute(f"ALTER TABLE movimentacoes_socios ADD COLUMN IF NOT EXISTS {nome} {tipo}")


def downgrade() -> None:
    for nome, _ in _COLS:
        op.execute(f"ALTER TABLE movimentacoes_socios DROP COLUMN IF EXISTS {nome}")
