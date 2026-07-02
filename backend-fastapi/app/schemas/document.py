from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class DocumentoBase(BaseModel):
    nome_arquivo: str
    tamanho_bytes: int
    tipo_mime: Optional[str] = None
    competencia: Optional[str] = None
    enviado_por: str = "CLIENTE"
    status: str = "RECEBIDO"

class DocumentoCreate(DocumentoBase):
    cliente_id: UUID
    caminho_storage: str

class DocumentoUpdate(BaseModel):
    status: Optional[str] = None

class DocumentoResponse(DocumentoBase):
    id: UUID
    cliente_id: UUID
    caminho_storage: str
    data_envio: datetime

    model_config = ConfigDict(from_attributes=True)

class NotifyRequest(BaseModel):
    faltantes: Optional[list[str]] = None

class AIValidationResponse(BaseModel):
    validados: list[str]
    faltantes: list[str]
