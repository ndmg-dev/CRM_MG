import re
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from app.enums.visibilidade_sistemas import VisibilidadeSistemas

CODIGO_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]{1,49}$")

def normalizar_codigo(valor: str) -> str:
    return valor.strip().upper().replace(" ", "_")

class SetorBase(BaseModel):
    codigo: str
    nome: str
    cor: Optional[str] = None
    ativo: bool = True
    visibilidade_sistemas: VisibilidadeSistemas = VisibilidadeSistemas.PROPRIO
    setores_visiveis: List[str] = []

    @model_validator(mode="after")
    def validar_setores_visiveis(self):
        # A lista só faz sentido em PERSONALIZADO; nos demais modos ela seria
        # uma configuração morta que engana quem lê a tela depois.
        if self.visibilidade_sistemas != VisibilidadeSistemas.PERSONALIZADO:
            self.setores_visiveis = []
        else:
            self.setores_visiveis = sorted(
                {normalizar_codigo(c) for c in self.setores_visiveis if c.strip()}
            )
            if not self.setores_visiveis:
                raise ValueError(
                    "No modo PERSONALIZADO informe ao menos um setor visível"
                )
        return self

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
    visibilidade_sistemas: Optional[VisibilidadeSistemas] = None
    # A coerência entre modo e lista depende do estado já gravado, então é
    # verificada no endpoint, depois de mesclar os campos enviados.
    setores_visiveis: Optional[List[str]] = None

    @field_validator("setores_visiveis")
    @classmethod
    def normalizar_visiveis(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        return sorted({normalizar_codigo(c) for c in v if c.strip()})

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
