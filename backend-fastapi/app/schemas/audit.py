from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class UserSessionResponse(BaseModel):
    id: UUID
    usuario_id: UUID
    inicio: datetime
    ultima_atividade: datetime
    fim: datetime | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    ativa: bool
    usuario_nome: str | None = None

    model_config = {"from_attributes": True}


class UserSessionActiveResponse(UserSessionResponse):
    """Extended session response with user profile details for active sessions list."""
    usuario_email: str | None = None
    usuario_perfil: str | None = None
    usuario_setor: str | None = None
    usuario_foto_perfil: str | None = None

    model_config = {"from_attributes": True}


class SystemAccessLogResponse(BaseModel):
    id: int
    usuario_id: UUID
    sistema_id: UUID
    inicio: datetime
    fim: datetime | None = None
    duracao_segundos: int | None = None
    usuario_nome: str | None = None
    sistema_nome: str | None = None

    model_config = {"from_attributes": True}


class SystemUsageSummary(BaseModel):
    sistema_id: str
    sistema_nome: str
    total_acessos: int
    tempo_total_minutos: int


class AuditDashboardResponse(BaseModel):
    usuarios_online: int
    sessoes_hoje: int
    acoes_hoje: int
    sistema_mais_usado: str | None = None
    sessoes_ativas: list[UserSessionResponse]
