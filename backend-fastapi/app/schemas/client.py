from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.enums.tax_regime import RegimeTributario

class ClienteBase(BaseModel):
    razao_social: str
    nome_fantasia: Optional[str] = None
    cnpj: str
    regime_tributario: Optional[RegimeTributario] = None
    status_cnpj: Optional[str] = None
    contato_principal: Optional[str] = None
    telefone_whatsapp: Optional[str] = None
    documentos_exigidos: Optional[str] = None

class ClienteCreate(ClienteBase):
    pass

class ClienteUpdate(BaseModel):
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    cnpj: Optional[str] = None
    regime_tributario: Optional[RegimeTributario] = None
    status_cnpj: Optional[str] = None
    contato_principal: Optional[str] = None
    telefone_whatsapp: Optional[str] = None
    documentos_exigidos: Optional[str] = None

class ClienteResponse(ClienteBase):
    id: UUID
    data_criacao: datetime
    data_atualizacao: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
