import re
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID

CODIGO_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]{1,49}$")

def normalizar_codigo(valor: str) -> str:
    return valor.strip().upper().replace(" ", "_")

class SetorBase(BaseModel):
    codigo: str
    nome: str
    cor: Optional[str] = None
    ativo: bool = True

    @field_validator("codigo")
    @classmethod
    def validar_codigo(cls, v: str) -> str:
        v = normalizar_codigo(v)
        if not CODIGO_PATTERN.match(v):
            raise ValueError(
                "Código deve ter de 2 a 50 caracteres, começar com letra e conter "
                "apenas letras maiúsculas, números e underscore"
            )
        return v

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nome do setor é obrigatório")
        return v

class SetorCreate(SetorBase):
    pass

class SetorUpdate(BaseModel):
    # `codigo` é imutável: ele é a chave usada por usuarios.setor,
    # tarefas.setor_origem e sistemas.setor.
    nome: Optional[str] = None
    cor: Optional[str] = None
    ativo: Optional[bool] = None

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Nome do setor é obrigatório")
        return v

class SetorResponse(SetorBase):
    id: UUID
    data_criacao: datetime
    total_usuarios: int = 0

    model_config = ConfigDict(from_attributes=True)
