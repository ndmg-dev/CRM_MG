from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.enums.profile import Perfil

def normalizar_email(valor: str) -> str:
    """E-mails são comparados em minúsculo para evitar cadastros duplicados
    (o UNIQUE do Postgres é case-sensitive)."""
    return valor.strip().lower()

class UsuarioBase(BaseModel):
    nome: str
    email: EmailStr
    perfil: Perfil
    # `setor` guarda o `codigo` de um registro da tabela `setores`; a validação
    # é feita no endpoint, contra o banco, e não por enum.
    setor: Optional[str] = None
    ativo: bool = True
    foto_perfil: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validar_email(cls, v: str) -> str:
        return normalizar_email(v)

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nome é obrigatório")
        return v

class UsuarioCreate(UsuarioBase):
    pass

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    perfil: Optional[Perfil] = None
    setor: Optional[str] = None
    ativo: Optional[bool] = None
    foto_perfil: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validar_email(cls, v: Optional[str]) -> Optional[str]:
        return normalizar_email(v) if v else v

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Nome é obrigatório")
        return v

class UsuarioResponse(UsuarioBase):
    id: UUID
    data_criacao: datetime

    model_config = ConfigDict(from_attributes=True)
