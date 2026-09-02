from app.db.base import Base
from app.models.user import Usuario
from app.models.sector import Setor
from app.models.client import Cliente
from app.models.task import Tarefa
from app.models.system import Sistema
from app.models.user_system_access import UsuarioSistemaAcesso
from app.models.notification import Notificacao
from app.models.audit_log import LogAuditoria
from app.models.document import Documento
from app.models.client_token import ClientToken
from app.models.user_session import UserSession
from app.models.system_access_log import SystemAccessLog
from app.models.release import Release, ReleaseNote, ReleaseRead
from app.models.pomodoro import PomodoroPreferencia, PomodoroSetorEstado

# Expose models to Alembic and other parts of the application
__all__ = [
    "Base",
    "Usuario",
    "Setor",
    "Cliente",
    "Tarefa",
    "Sistema",
    "UsuarioSistemaAcesso",
    "LogAuditoria",
    "Documento",
    "ClientToken",
    "UserSession",
    "SystemAccessLog",
    "Release",
    "ReleaseNote",
    "ReleaseRead",
    "PomodoroPreferencia",
    "PomodoroSetorEstado",
]
