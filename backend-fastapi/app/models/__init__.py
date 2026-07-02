from app.db.base import Base
from app.models.user import Usuario
from app.models.client import Cliente
from app.models.task import Tarefa
from app.models.system import Sistema
from app.models.user_system_access import UsuarioSistemaAcesso
from app.models.notification import Notificacao
from app.models.audit_log import LogAuditoria
from app.models.document import Documento
from app.models.client_token import ClientToken

# Expose models to Alembic and other parts of the application
__all__ = [
    "Base",
    "Usuario",
    "Cliente",
    "Tarefa",
    "Sistema",
    "UsuarioSistemaAcesso",
    "LogAuditoria",
    "Documento",
    "ClientToken"
]
