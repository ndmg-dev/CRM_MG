from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class NotificacaoBase(BaseModel):
    usuario_id: UUID
    titulo: str
    mensagem: str
    lida: bool = False

class NotificacaoCreate(NotificacaoBase):
    pass

class NotificacaoResponse(NotificacaoBase):
    id: UUID
    data_criacao: datetime

    model_config = ConfigDict(from_attributes=True)
