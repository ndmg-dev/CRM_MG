from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import Usuario
from app.models.audit_log import LogAuditoria
from app.schemas.user import UsuarioResponse, UsuarioUpdate

router = APIRouter()

@router.get("", response_model=List[UsuarioResponse])
async def get_usuarios(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    result = await db.execute(select(Usuario))
    return result.scalars().all()

@router.get("/{id}", response_model=UsuarioResponse)
async def get_usuario(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    user = await db.scalar(select(Usuario).where(Usuario.id == id))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario not found")
    return user

@router.put("/{id}", response_model=UsuarioResponse)
async def update_usuario(
    id: UUID,
    user_in: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"]))
):
    user = await db.scalar(select(Usuario).where(Usuario.id == id))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario not found")
    
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    audit = LogAuditoria(
        usuario_id=current_user.id,
        acao="UPDATE_USER",
        alvo=f"Usuário {user.nome}",
        detalhes={"mudancas": update_data}
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(user)
    return user
