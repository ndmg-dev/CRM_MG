from typing import List, Optional, Literal
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID

Fase = Literal["focus", "rest"]


class PomodoroPreferenciaResponse(BaseModel):
    focus_min: int
    rest_min: int
    cycles_total: int
    alert_sound: bool
    alert_browser: bool

    model_config = ConfigDict(from_attributes=True)


class PomodoroPreferenciaUpdate(BaseModel):
    focus_min: int = Field(ge=1, le=120)
    rest_min: int = Field(ge=1, le=60)
    cycles_total: int = Field(ge=1, le=12)
    alert_sound: bool = True
    alert_browser: bool = True


class PomodoroMembro(BaseModel):
    id: UUID
    nome: str
    perfil: str
    status: str  # 'Livre' | 'Em foco' | 'Em pausa'


class PomodoroSetorResponse(BaseModel):
    setor: str
    active: bool
    phase: Fase
    cycle: int
    cycles_total: int
    focus_min: int
    rest_min: int
    time_left: int  # segundos
    # Quem chamou GET pode ou não ser líder do setor (só líder inicia/encerra).
    pode_controlar: bool
    started_by_nome: Optional[str] = None
    membros: List[PomodoroMembro]


class PomodoroSetorStart(BaseModel):
    focus_min: int = Field(ge=1, le=120)
    rest_min: int = Field(ge=1, le=60)
    cycles_total: int = Field(ge=1, le=12)
