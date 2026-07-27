from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import Usuario
from app.models.system import Sistema
from app.schemas.system import SistemaResponse
from app.services.visibility_service import (
    carregar_contexto_visibilidade,
    filtrar_sistemas,
)

router = APIRouter()

@router.get("", response_model=List[SistemaResponse])
async def get_sistemas(
    categoria: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    query = select(Sistema).where(Sistema.ativo == True)
    if categoria:
        query = query.where(Sistema.categoria == categoria)

    result = await db.execute(query)
    sistemas = result.scalars().all()

    # A política de visibilidade é definida no cadastro do setor do usuário.
    setor, acessos = await carregar_contexto_visibilidade(db, current_user)
    return filtrar_sistemas(sistemas, current_user, setor, acessos)
