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
    clienteId: Optional[UUID] = None
    responsavelId: Optional[UUID] = None
    setorOrigem: Optional[Setor] = None
    status: StatusTarefa = StatusTarefa.PENDENTE
    prioridade: Prioridade = Prioridade.MEDIA
    dataVencimento: Optional[datetime] = None

class TarefaCreate(TarefaBase):
    pass

class TarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    clienteId: Optional[UUID] = None
    responsavelId: Optional[UUID] = None
    setorOrigem: Optional[Setor] = None
    status: Optional[StatusTarefa] = None
    prioridade: Optional[Prioridade] = None
    dataVencimento: Optional[datetime] = None
    dataConclusao: Optional[datetime] = None

class TarefaStatusUpdate(BaseModel):
    novoStatus: StatusTarefa

class TarefaResponse(BaseModel):
    id: UUID
    titulo: str
    descricao: Optional[str] = None
    clienteId: Optional[UUID] = None
    clienteNome: Optional[str] = None
    responsavelId: Optional[UUID] = None
    responsavelNome: Optional[str] = None
    setorOrigem: Optional[Setor] = None
    status: StatusTarefa
    prioridade: Prioridade
    dataVencimento: Optional[datetime] = None
    dataConclusao: Optional[datetime] = None
    dataCriacao: datetime
    dataAtualizacao: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
