from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import Usuario
from app.models.system import Sistema
from app.models.system_access_log import SystemAccessLog
from app.schemas.audit import SystemAccessLogResponse, SystemUsageSummary

router = APIRouter()


class SistemaIdBody(BaseModel):
    sistema_id: UUID


@router.post("/entrar")
async def entrar_sistema(
    body: SistemaIdBody,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    now = datetime.utcnow()

    # Close any previous open entry for this user + sistema
    result = await db.execute(
        select(SystemAccessLog).where(
            and_(
                SystemAccessLog.usuario_id == current_user.id,
                SystemAccessLog.sistema_id == body.sistema_id,
                SystemAccessLog.fim == None,
            )
        )
    )
    open_entries = result.scalars().all()
    for entry in open_entries:
        entry.fim = now
        entry.duracao_segundos = int((now - entry.inicio).total_seconds())

    # Create new entry
    new_log = SystemAccessLog(
        usuario_id=current_user.id,
        sistema_id=body.sistema_id,
        inicio=now,
    )
    db.add(new_log)
    await db.commit()
    return {"ok": True}


@router.post("/sair")
async def sair_sistema(
    body: SistemaIdBody,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    now = datetime.utcnow()

    result = await db.execute(
        select(SystemAccessLog).where(
            and_(
                SystemAccessLog.usuario_id == current_user.id,
                SystemAccessLog.sistema_id == body.sistema_id,
                SystemAccessLog.fim == None,
            )
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="Nenhum acesso aberto encontrado")

    entry.fim = now
    entry.duracao_segundos = int((now - entry.inicio).total_seconds())
    await db.commit()
    return {"ok": True}


@router.get("/resumo")
async def resumo_sistema(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"])),
):
    # Top 10 most used systems
    usage_query = (
        select(
            SystemAccessLog.sistema_id,
            Sistema.nome.label("sistema_nome"),
            func.count(SystemAccessLog.id).label("total_acessos"),
            func.coalesce(func.sum(SystemAccessLog.duracao_segundos), 0).label("tempo_total_segundos"),
        )
        .join(Sistema, Sistema.id == SystemAccessLog.sistema_id)
        .group_by(SystemAccessLog.sistema_id, Sistema.nome)
        .order_by(func.count(SystemAccessLog.id).desc())
        .limit(10)
    )
    result = await db.execute(usage_query)
    usage_rows = result.all()

    top_sistemas = [
        SystemUsageSummary(
            sistema_id=str(row.sistema_id),
            sistema_nome=row.sistema_nome,
            total_acessos=row.total_acessos,
            tempo_total_minutos=row.tempo_total_segundos // 60,
        )
        for row in usage_rows
    ]

    # Recent 50 access logs
    recent_query = (
        select(
            SystemAccessLog,
            Usuario.nome.label("usuario_nome"),
            Sistema.nome.label("sistema_nome"),
        )
        .join(Usuario, Usuario.id == SystemAccessLog.usuario_id)
        .join(Sistema, Sistema.id == SystemAccessLog.sistema_id)
        .order_by(SystemAccessLog.inicio.desc())
        .limit(50)
    )
    result = await db.execute(recent_query)
    recent_rows = result.all()

    acessos_recentes = []
    for row in recent_rows:
        log = row[0]
        acessos_recentes.append(
            SystemAccessLogResponse(
                id=log.id,
                usuario_id=log.usuario_id,
                sistema_id=log.sistema_id,
                inicio=log.inicio,
                fim=log.fim,
                duracao_segundos=log.duracao_segundos,
                usuario_nome=row.usuario_nome,
                sistema_nome=row.sistema_nome,
            )
        )

    return {
        "top_sistemas": top_sistemas,
        "acessos_recentes": acessos_recentes,
    }
