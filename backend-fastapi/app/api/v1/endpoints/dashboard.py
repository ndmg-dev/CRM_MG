from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import Usuario
from app.models.system import Sistema
from app.models.task import Tarefa
from app.models.audit_log import LogAuditoria
from app.schemas.dashboard import DashboardSummary, AuditLogSchema, PersonalDashboardSummary, DeadlineItem

router = APIRouter()

TAREFA_STATUS_ABERTOS = ["PENDENTE", "EM_PROCESSAMENTO", "AGUARDANDO_CLIENTE"]


def _due_label(due: datetime, now: datetime) -> str:
    days = (due.date() - now.date()).days
    if days < 0:
        return "Atrasado"
    if days == 0:
        return "Hoje"
    if days == 1:
        return "Amanhã"
    return f"{days} dias"

@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    total_usuarios = await db.scalar(select(func.count()).select_from(Usuario))
    usuarios_ativos = await db.scalar(select(func.count()).select_from(Usuario).where(Usuario.ativo == True))
    total_sistemas = await db.scalar(select(func.count()).select_from(Sistema).where(Sistema.ativo == True))
    
    tarefas_abertas = await db.scalar(
        select(func.count()).select_from(Tarefa).where(Tarefa.status.in_(["PENDENTE", "EM_PROCESSAMENTO", "AGUARDANDO_CLIENTE"]))
    )
    
    # Just a placeholder for "vencidas", requires datetime comparison.
    # In a real app we would check `data_vencimento < now() and status not CONCLUIDO`
    tarefas_vencidas = 0
    
    # Recent logs
    logs_result = await db.execute(
        select(LogAuditoria).order_by(LogAuditoria.data_hora.desc()).limit(5)
    )
    logs = logs_result.scalars().all()
    
    recent_logs = []
    for log in logs:
        recent_logs.append(AuditLogSchema(
            id=log.id,
            dataHora=log.data_hora.isoformat(),
            usuarioId=log.usuario_id,
            usuarioNome="Sistema" if not log.usuario_id else "Usuário", # placeholder without join
            acao=log.acao,
            alvo=log.alvo,
            detalhes=log.detalhes
        ))
        
    return DashboardSummary(
        totalUsuarios=total_usuarios or 0,
        usuariosAtivos=usuarios_ativos or 0,
        totalSistemas=total_sistemas or 0,
        tarefasAbertas=tarefas_abertas or 0,
        tarefasVencidas=tarefas_vencidas or 0,
        recentAuditLogs=recent_logs
    )


@router.get("/personal", response_model=PersonalDashboardSummary)
async def get_personal_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    now = datetime.utcnow()

    pending_tasks = await db.scalar(
        select(func.count()).select_from(Tarefa).where(
            Tarefa.responsavel_id == current_user.id,
            Tarefa.status.in_(TAREFA_STATUS_ABERTOS)
        )
    )

    result = await db.execute(
        select(Tarefa)
        .where(
            Tarefa.responsavel_id == current_user.id,
            Tarefa.status.in_(TAREFA_STATUS_ABERTOS),
            Tarefa.data_vencimento.isnot(None)
        )
        .order_by(Tarefa.data_vencimento.asc())
        .limit(3)
    )
    proximas = result.scalars().all()

    deadlines = [
        DeadlineItem(id=t.id, name=t.titulo, dueLabel=_due_label(t.data_vencimento, now))
        for t in proximas
    ]

    return PersonalDashboardSummary(
        pendingTasks=pending_tasks or 0,
        nextDeadlineLabel=deadlines[0].dueLabel if deadlines else None,
        deadlines=deadlines
    )
