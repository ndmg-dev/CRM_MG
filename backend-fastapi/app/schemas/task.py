from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.enums.sector import Setor
from app.enums.task_status import StatusTarefa
from app.enums.priority import Prioridade

class TarefaBase(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    cliente_id: Optional[UUID] = None
    responsavel_id: Optional[UUID] = None
    setor_origem: Optional[Setor] = None
    status: StatusTarefa = StatusTarefa.PENDENTE
    prioridade: Prioridade = Prioridade.MEDIA
    data_vencimento: Optional[datetime] = None

class TarefaCreate(TarefaBase):
    pass

class TarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    cliente_id: Optional[UUID] = None
    responsavel_id: Optional[UUID] = None
    setor_origem: Optional[Setor] = None
    status: Optional[StatusTarefa] = None
    prioridade: Optional[Prioridade] = None
    data_vencimento: Optional[datetime] = None
    data_conclusao: Optional[datetime] = None

class TarefaStatusUpdate(BaseModel):
    novo_status: StatusTarefa

class TarefaResponse(BaseModel):
    id: UUID
    titulo: str
    descricao: Optional[str] = None
    cliente_id: Optional[UUID] = None
    cliente_nome: Optional[str] = None
    responsavel_id: Optional[UUID] = None
    responsavel_nome: Optional[str] = None
    setor_origem: Optional[Setor] = None
    status: StatusTarefa
    prioridade: Prioridade
    data_vencimento: Optional[datetime] = None
    data_conclusao: Optional[datetime] = None
    data_criacao: datetime
    data_atualizacao: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
