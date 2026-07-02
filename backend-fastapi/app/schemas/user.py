from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.enums.profile import Perfil
from app.enums.sector import Setor

class UsuarioBase(BaseModel):
    nome: str
    email: EmailStr
    perfil: Perfil
    setor: Optional[Setor] = None
    ativo: bool = True
    foto_perfil: Optional[str] = None

class UsuarioCreate(UsuarioBase):
    pass

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    perfil: Optional[Perfil] = None
    setor: Optional[Setor] = None
    ativo: Optional[bool] = None
    foto_perfil: Optional[str] = None

class UsuarioResponse(UsuarioBase):
    id: UUID
    data_criacao: datetime

    model_config = ConfigDict(from_attributes=True)
