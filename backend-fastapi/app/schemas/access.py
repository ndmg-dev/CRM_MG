from pydantic import BaseModel
from uuid import UUID

class AccessGrantRequest(BaseModel):
    # snake_case como no resto dos schemas: o cliente converte camelCase para
    # snake antes de enviar (`convertKeysToSnake` em lib/api.ts), então os
    # nomes em camelCase que existiam aqui nunca chegavam a casar.
    usuario_id: UUID
    sistema_id: UUID
