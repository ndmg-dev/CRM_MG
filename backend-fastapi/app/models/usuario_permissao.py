from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class UsuarioPermissao(Base):
    """Permissão por ação concedida a um usuário (ADMIN tem todas sem precisar de linha).

    O acesso ao sistema em si continua sendo `UsuarioSistemaAcesso`/visibilidade do setor; esta tabela diz o que a pessoa pode FAZER
    dentro dele. O código é namespaced pelo sistema (ex.: "icms_saidas.aprovar_lotes"), então a mesma tabela serve a outros sistemas.
    """

    __tablename__ = "usuario_permissoes"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    permissao = Column(String(80), nullable=False)
    granted_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    granted_by = Column(UUID(as_uuid=True), nullable=True)

    __table_args__ = (UniqueConstraint("usuario_id", "permissao", name="uk_usuario_permissao"),)
