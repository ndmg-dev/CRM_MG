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
from app.schemas.dashboard import DashboardSummary, AuditLogSchema

router = APIRouter()

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
