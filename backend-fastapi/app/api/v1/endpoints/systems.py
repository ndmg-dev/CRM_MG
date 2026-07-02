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
    
    # Managers see all. Others see based on Setor (GERAL + seu próprio) ou acessos extras explícitos
    if current_user.perfil not in ["ADMIN", "COORDENADOR"]:
        from app.models.user_system_access import UsuarioSistemaAcesso
        access_query = select(UsuarioSistemaAcesso.sistema_id).where(
            UsuarioSistemaAcesso.usuario_id == current_user.id
        )
        access_result = await db.execute(access_query)
        allowed_ids = {row for row in access_result.scalars()}
        
        sistemas = [
            s for s in sistemas 
            if s.setor == "GERAL" or s.setor == current_user.setor or s.id in allowed_ids
        ]
        
    return sistemas
