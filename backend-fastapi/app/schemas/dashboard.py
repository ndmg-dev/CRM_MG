from pydantic import BaseModel
from typing import List
from uuid import UUID

class AuditLogSchema(BaseModel):
    id: int
    dataHora: str
    usuarioId: UUID | None = None
    usuarioNome: str | None = None
    acao: str
    alvo: str | None = None
    detalhes: dict | None = None

class DashboardSummary(BaseModel):
    totalUsuarios: int
    usuariosAtivos: int
    totalSistemas: int
    tarefasAbertas: int
    tarefasVencidas: int
    recentAuditLogs: List[AuditLogSchema]
