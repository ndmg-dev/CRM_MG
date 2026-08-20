from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import Usuario
from app.models.system import Sistema
from app.models.user_system_access import UsuarioSistemaAcesso
from app.models.audit_log import LogAuditoria
from app.schemas.system import SistemaResponse
from app.schemas.access import AccessGrantRequest

router = APIRouter()

@router.post("/grant", status_code=status.HTTP_204_NO_CONTENT)
async def grant_access(
    req: AccessGrantRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"]))
):
    exists = await db.scalar(
        select(UsuarioSistemaAcesso).where(
            and_(
                UsuarioSistemaAcesso.usuario_id == req.usuario_id,
                UsuarioSistemaAcesso.sistema_id == req.sistema_id
            )
        )
    )
    if not exists:
        access = UsuarioSistemaAcesso(
            usuario_id=req.usuario_id,
            sistema_id=req.sistema_id,
            granted_by=current_user.id
        )
        db.add(access)
        
        audit = LogAuditoria(
            usuario_id=current_user.id,
            acao="GRANT_ACCESS",
            alvo=f"Sistema ID {req.sistema_id}",
            detalhes={"usuario_alvo": str(req.usuario_id)}
        )
        db.add(audit)
        
        await db.commit()

@router.post("/revoke", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_access(
    req: AccessGrantRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"]))
):
    access = await db.scalar(
        select(UsuarioSistemaAcesso).where(
            and_(
                UsuarioSistemaAcesso.usuario_id == req.usuario_id,
                UsuarioSistemaAcesso.sistema_id == req.sistema_id
            )
        )
    )
    if access:
        await db.delete(access)
        
        audit = LogAuditoria(
            usuario_id=current_user.id,
            acao="REVOKE_ACCESS",
            alvo=f"Sistema ID {req.sistema_id}",
            detalhes={"usuario_alvo": str(req.usuario_id)}
        )
        db.add(audit)
        
        await db.commit()

@router.get("/usuario/{user_id}", response_model=List[SistemaResponse])
async def get_user_access(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"]))
):
    query = (
        select(Sistema)
        .join(UsuarioSistemaAcesso, Sistema.id == UsuarioSistemaAcesso.sistema_id)
        .where(UsuarioSistemaAcesso.usuario_id == user_id)
    )
    result = await db.execute(query)
    return result.scalars().all()
