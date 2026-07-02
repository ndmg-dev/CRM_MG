from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.enums.system_category import CategoriaSistema
from app.enums.setor_sistema import SetorSistema

class SistemaBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    slug: str
    categoria: CategoriaSistema
    setor: Optional[SetorSistema] = None
    url: Optional[str] = None
    icone: Optional[str] = None
    allowed_origin: Optional[str] = None
    ativo: bool = True

class SistemaCreate(SistemaBase):
    pass

class SistemaUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    slug: Optional[str] = None
    categoria: Optional[CategoriaSistema] = None
    setor: Optional[SetorSistema] = None
    url: Optional[str] = None
    icone: Optional[str] = None
    allowed_origin: Optional[str] = None
    ativo: Optional[bool] = None

class SistemaResponse(SistemaBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
