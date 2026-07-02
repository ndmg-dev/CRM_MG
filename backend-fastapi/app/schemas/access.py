from pydantic import BaseModel
from uuid import UUID

class AccessGrantRequest(BaseModel):
    usuarioId: UUID
    sistemaId: UUID
