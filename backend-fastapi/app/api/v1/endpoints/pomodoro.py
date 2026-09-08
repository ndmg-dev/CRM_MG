from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import Usuario
from app.models.sector import Setor
from app.models.pomodoro import PomodoroPreferencia, PomodoroSetorEstado
from app.schemas.pomodoro import (
    PomodoroPreferenciaResponse,
    PomodoroPreferenciaUpdate,
    PomodoroSetorResponse,
    PomodoroSetorStart,
    PomodoroMembro,
)

router = APIRouter()

# Quem pode iniciar/encerrar o pomodoro de setor — mesmo corte usado no resto
# do CRM pra "líder de área": ADMIN (liderança geral) ou COORDENADOR do
# próprio setor.
PERFIS_LIDER = {"ADMIN", "COORDENADOR"}


def _pode_liderar(user: Usuario, setor: str) -> bool:
    return user.perfil in PERFIS_LIDER and (user.perfil == "ADMIN" or user.setor == setor)


async def _validar_setor(db: AsyncSession, setor: str) -> str:
    """Confere que `setor` é um código real da tabela `setores` — sem isso,
    qualquer `?setor=` (autenticado, mas não necessariamente admin) criava
    silenciosamente uma linha nova em pomodoro_setor_estado pra um setor
    inexistente (achado na varredura de segurança; não dava acesso indevido
    a nada porque `_pode_liderar` continua checando setor real, mas poluía a
    tabela com registros órfãos)."""
    codigo = setor.strip().upper()
    existe = await db.scalar(select(Setor).where(Setor.codigo == codigo))
    if not existe:
        raise HTTPException(status_code=400, detail=f"Setor '{codigo}' não existe")
    return codigo


# ---------------------------------------------------------------------------
# Preferências individuais
# ---------------------------------------------------------------------------

async def _obter_ou_criar_preferencia(db: AsyncSession, usuario_id) -> PomodoroPreferencia:
    pref = await db.scalar(
        select(PomodoroPreferencia).where(PomodoroPreferencia.usuario_id == usuario_id)
    )
    if pref is None:
        pref = PomodoroPreferencia(usuario_id=usuario_id)
        db.add(pref)
        await db.commit()
        await db.refresh(pref)
    return pref


@router.get("/preferencias", response_model=PomodoroPreferenciaResponse)
async def get_preferencias(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return await _obter_ou_criar_preferencia(db, current_user.id)


@router.put("/preferencias", response_model=PomodoroPreferenciaResponse)
async def put_preferencias(
    dados: PomodoroPreferenciaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    pref = await _obter_ou_criar_preferencia(db, current_user.id)
    pref.focus_min = dados.focus_min
    pref.rest_min = dados.rest_min
    pref.cycles_total = dados.cycles_total
    pref.alert_sound = dados.alert_sound
    pref.alert_browser = dados.alert_browser
    await db.commit()
    await db.refresh(pref)
    return pref


# ---------------------------------------------------------------------------
# Pomodoro de setor (relógio compartilhado)
# ---------------------------------------------------------------------------

def _resolve(estado: PomodoroSetorEstado, now: datetime) -> tuple[str, int, int, bool]:
    """A partir da âncora (phase/cycle/phase_started_at) e do tempo atual,
    calcula em que fase/ciclo o pomodoro está agora e quantos segundos
    faltam pra próxima virada — andando fase a fase (nunca mais que
    2 * cycles_total voltas, já que cada ciclo tem só foco+descanso).
    Retorna (phase, cycle, time_left, finished)."""
    phase, cycle = estado.phase, estado.cycle
    elapsed = (now - estado.phase_started_at).total_seconds()
    phase_len = (estado.focus_min if phase == "focus" else estado.rest_min) * 60

    guard = 2 * estado.cycles_total + 2
    while elapsed >= phase_len and guard > 0:
        guard -= 1
        elapsed -= phase_len
        if phase == "focus":
            phase = "rest"
            phase_len = estado.rest_min * 60
        else:
            if cycle >= estado.cycles_total:
                return phase, cycle, 0, True
            cycle += 1
            phase = "focus"
            phase_len = estado.focus_min * 60

    time_left = max(0, round(phase_len - elapsed))
    return phase, cycle, time_left, False


def _status_membro(setor_ativo: bool, phase: str) -> str:
    if not setor_ativo:
        return "Livre"
    return "Em foco" if phase == "focus" else "Em pausa"


@router.get("/setor", response_model=PomodoroSetorResponse)
async def get_setor(
    setor: str = Query("TI"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    setor = await _validar_setor(db, setor)
    estado = await db.scalar(select(PomodoroSetorEstado).where(PomodoroSetorEstado.setor == setor))
    if estado is None:
        estado = PomodoroSetorEstado(setor=setor, active=False)
        db.add(estado)
        await db.commit()
        await db.refresh(estado)

    now = datetime.utcnow()
    if estado.active and estado.phase_started_at:
        phase, cycle, time_left, finished = _resolve(estado, now)
        if finished:
            estado.active = False
            estado.phase = "focus"
            estado.cycle = 1
            estado.phase_started_at = None
            await db.commit()
            phase, cycle, time_left = "focus", 1, estado.focus_min * 60
    else:
        phase, cycle, time_left = "focus", 1, estado.focus_min * 60

    membros_result = await db.execute(
        select(Usuario).where(Usuario.setor == setor, Usuario.ativo == True).order_by(Usuario.nome)  # noqa: E712
    )
    status_atual = _status_membro(estado.active, phase)
    membros = [
        PomodoroMembro(id=u.id, nome=u.nome, perfil=u.perfil, status=status_atual)
        for u in membros_result.scalars().all()
    ]

    started_by_nome: Optional[str] = None
    if estado.active and estado.started_by:
        lider = await db.scalar(select(Usuario).where(Usuario.id == estado.started_by))
        started_by_nome = lider.nome if lider else None

    return PomodoroSetorResponse(
        setor=setor,
        active=estado.active,
        phase=phase,
        cycle=cycle,
        cycles_total=estado.cycles_total,
        focus_min=estado.focus_min,
        rest_min=estado.rest_min,
        time_left=time_left,
        pode_controlar=_pode_liderar(current_user, setor),
        started_by_nome=started_by_nome,
        membros=membros,
    )


@router.post("/setor/iniciar", response_model=PomodoroSetorResponse)
async def iniciar_setor(
    dados: PomodoroSetorStart,
    setor: str = Query("TI"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    setor = await _validar_setor(db, setor)
    if not _pode_liderar(current_user, setor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Somente um líder do setor pode iniciar o pomodoro para todo o time.",
        )
    estado = await db.scalar(select(PomodoroSetorEstado).where(PomodoroSetorEstado.setor == setor))
    if estado is None:
        estado = PomodoroSetorEstado(setor=setor)
        db.add(estado)

    estado.active = True
    estado.phase = "focus"
    estado.cycle = 1
    estado.focus_min = dados.focus_min
    estado.rest_min = dados.rest_min
    estado.cycles_total = dados.cycles_total
    estado.phase_started_at = datetime.utcnow()
    estado.started_by = current_user.id
    await db.commit()
    return await get_setor(setor=setor, db=db, current_user=current_user)


@router.post("/setor/encerrar", response_model=PomodoroSetorResponse)
async def encerrar_setor(
    setor: str = Query("TI"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    setor = await _validar_setor(db, setor)
    if not _pode_liderar(current_user, setor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Somente um líder do setor pode encerrar o pomodoro do time.",
        )
    estado = await db.scalar(select(PomodoroSetorEstado).where(PomodoroSetorEstado.setor == setor))
    if estado is not None:
        estado.active = False
        estado.phase = "focus"
        estado.cycle = 1
        estado.phase_started_at = None
        await db.commit()
    return await get_setor(setor=setor, db=db, current_user=current_user)
