from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import Usuario
from app.models.system import Sistema
from app.models.client import Cliente
from app.models.task import Tarefa
from app.schemas.search import SearchResponse, SearchResultItem

router = APIRouter()

@router.get("", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=2, description="Search query"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    results: List[SearchResultItem] = []
    
    # 1. Search Sistemas
    # Visibility logic: ADMIN sees all, others see their setor + GERAL
    query_sistemas = select(Sistema).where(
        or_(
            Sistema.nome.ilike(f"%{q}%"),
            Sistema.descricao.ilike(f"%{q}%")
        )
    ).limit(5)
    
    db_sistemas = await db.execute(query_sistemas)
    sistemas = db_sistemas.scalars().all()
    
    for s in sistemas:
        # Visibility check
        setor_sistema = s.setor or "GERAL"
        is_manager = current_user.perfil in ["ADMIN", "COORDENADOR"]
        
        can_view = False
        if setor_sistema == "RESTRITO":
            can_view = current_user.perfil == "ADMIN"
        elif is_manager:
            can_view = True
        elif setor_sistema == "GERAL" or setor_sistema == current_user.setor:
            can_view = True
            
        if can_view:
            results.append(
                SearchResultItem(
                    id=str(s.id),
                    type="sistema",
                    title=s.nome,
                    subtitle="Sistema" + (f" - {s.categoria}" if s.categoria else ""),
                    url=f"/sistemas/{s.id}",
                    icon=s.icone or "building-2"
                )
            )

    # 2. Search Clientes
    query_clientes = select(Cliente).where(
        or_(
            Cliente.razao_social.ilike(f"%{q}%"),
            Cliente.nome_fantasia.ilike(f"%{q}%"),
            Cliente.cnpj.ilike(f"%{q}%")
        )
    ).limit(5)
    
    db_clientes = await db.execute(query_clientes)
    clientes = db_clientes.scalars().all()
    
    for c in clientes:
        results.append(
            SearchResultItem(
                id=str(c.id),
                type="cliente",
                title=c.nome_fantasia or c.razao_social,
                subtitle=f"CNPJ: {c.cnpj}",
                url=f"/clientes/{c.id}",
                icon="building-2"
            )
        )
        
    # 3. Search Tarefas
    # Visibility: Managers see all, others see tasks assigned to them or their sector
    query_tarefas = select(Tarefa).where(
        Tarefa.titulo.ilike(f"%{q}%")
    ).limit(5)
    
    db_tarefas = await db.execute(query_tarefas)
    tarefas = db_tarefas.scalars().all()
    
    for t in tarefas:
        is_manager = current_user.perfil in ["ADMIN", "COORDENADOR"]
        can_view = is_manager or t.responsavel_id == current_user.id or t.setor_origem == current_user.setor
        
        if can_view:
            results.append(
                SearchResultItem(
                    id=str(t.id),
                    type="tarefa",
                    title=t.titulo,
                    subtitle=f"Status: {t.status}",
                    url=f"/tarefas?id={t.id}", # Frontend kanban handles task selection?
                    icon="clipboard-list"
                )
            )
            
    return SearchResponse(results=results)
