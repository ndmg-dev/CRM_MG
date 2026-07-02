from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import Usuario
from app.models.notification import Notificacao
from app.schemas.notification import NotificacaoResponse

router = APIRouter()

@router.get("", response_model=List[NotificacaoResponse])
async def get_notificacoes(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    query = select(Notificacao).where(
        Notificacao.usuario_id == current_user.id
    ).order_by(Notificacao.lida, Notificacao.data_criacao.desc())
    
    result = await db.execute(query)
    return result.scalars().all()

@router.put("/{id}/ler", response_model=NotificacaoResponse)
async def mark_as_read(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    notification = await db.scalar(
        select(Notificacao).where(
            Notificacao.id == id,
            Notificacao.usuario_id == current_user.id
        )
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notification.lida = True
    await db.commit()
    await db.refresh(notification)
    
    return notification
