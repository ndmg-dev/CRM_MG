"""permissões por ação por usuário (usuario_permissoes)

Base do controle fino do sistema "ICMS Saídas": o ADMIN concede ao usuário ações específicas (consultar, operar, aprovar lotes,
gerir empresas, editar regras). O acesso ao sistema continua sendo `usuario_sistema_acessos`.

Idempotente (CREATE ... IF NOT EXISTS): o schema deste projeto também é criado por create_all no boot, então a tabela pode já existir
quando a migração rodar.

Revision ID: e8b1c4a7d2f9
Revises: d5a7b2c8e3f1
Create Date: 2026-11-04
"""

from alembic import op

revision = "e8b1c4a7d2f9"
down_revision = "d5a7b2c8e3f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS usuario_permissoes (
            id BIGSERIAL PRIMARY KEY,
            usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
            permissao VARCHAR(80) NOT NULL,
            granted_at TIMESTAMP NOT NULL DEFAULT now(),
            granted_by UUID NULL,
            CONSTRAINT uk_usuario_permissao UNIQUE (usuario_id, permissao)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_usuario_permissoes_usuario_id ON usuario_permissoes (usuario_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_usuario_permissoes_usuario_id")
    op.execute("DROP TABLE IF EXISTS usuario_permissoes")
