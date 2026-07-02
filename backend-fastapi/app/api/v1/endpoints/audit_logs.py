from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import Usuario
from app.models.audit_log import LogAuditoria
from app.schemas.audit_log import AuditLogResponse
from app.schemas.common import PaginatedResponse

router = APIRouter()

@router.get("", response_model=PaginatedResponse[AuditLogResponse])
async def get_auditoria(
    usuarioId: Optional[UUID] = None,
    acao: Optional[str] = None,
    dataInicio: Optional[str] = None,
    dataFim: Optional[str] = None,
    page: int = 0,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"]))
):
    query = select(LogAuditoria)
    
    if usuarioId:
        query = query.where(LogAuditoria.usuario_id == usuarioId)
    if acao:
        query = query.where(LogAuditoria.acao == acao)
        
    count_query = select(func.count()).select_from(query.subquery())
    total_elements = await db.scalar(count_query)
    
    query = query.order_by(LogAuditoria.data_hora.desc()).offset(page * size).limit(size)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    content = []
    for log in logs:
        content.append(AuditLogResponse(
            id=log.id,
            dataHora=log.data_hora.isoformat(),
            usuarioId=log.usuario_id,
            usuarioNome="Sistema" if not log.usuario_id else "Usuário", # Simplification without joins
            acao=log.acao,
            alvo=log.alvo,
            detalhes=log.detalhes
        ))
        
    total_pages = (total_elements + size - 1) // size if total_elements > 0 else 0
    
    return PaginatedResponse(
        content=content,
        totalElements=total_elements,
        totalPages=total_pages,
        page=page,
        size=size
    )
