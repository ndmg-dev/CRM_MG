import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class PomodoroPreferencia(Base):
    """Config individual de cada usuário (tempos + alertas). Uma linha por
    usuário — criada sob demanda na primeira leitura (ver endpoint), com os
    valores-padrão 25/5/4."""
    __tablename__ = "pomodoro_preferencias"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, unique=True)
    focus_min = Column(Integer, nullable=False, default=25)
    rest_min = Column(Integer, nullable=False, default=5)
    cycles_total = Column(Integer, nullable=False, default=4)
    alert_sound = Column(Boolean, nullable=False, default=True)
    alert_browser = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class PomodoroSetorEstado(Base):
    """Relógio compartilhado do pomodoro de setor: um registro por setor
    (hoje só 'TI' é usado). `phase_started_at` é o âncora — o tempo restante
    é sempre calculado a partir dele (now - phase_started_at), nunca por uma
    contagem local isolada por cliente, senão cada aba/usuário dessincroniza
    (ver handoff). `phase`/`cycle` guardam a fase/ciclo vigentes NA âncora;
    o cálculo de quantas fases já viraram desde então é feito em runtime
    pelo endpoint (`_resolve_sector_state`), que só grava de volta quando o
    pomodoro do setor termina todos os ciclos (auto-stop)."""
    __tablename__ = "pomodoro_setor_estado"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    setor = Column(String(50), nullable=False, unique=True)
    active = Column(Boolean, nullable=False, default=False)
    phase = Column(String(10), nullable=False, default="focus")  # 'focus' | 'rest'
    cycle = Column(Integer, nullable=False, default=1)
    cycles_total = Column(Integer, nullable=False, default=4)
    focus_min = Column(Integer, nullable=False, default=25)
    rest_min = Column(Integer, nullable=False, default=5)
    phase_started_at = Column(DateTime, nullable=True)
    started_by = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
