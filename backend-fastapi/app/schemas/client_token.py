from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class ClientTokenBase(BaseModel):
    ativo: bool = True

class ClientTokenCreate(ClientTokenBase):
    cliente_id: UUID

class ClientTokenResponse(ClientTokenBase):
    id: UUID
    cliente_id: UUID
    token: str
    data_expiracao: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
