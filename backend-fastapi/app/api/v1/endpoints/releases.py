from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import Usuario
from app.models.release import Release, ReleaseNote, ReleaseRead
from app.schemas.release import ReleaseResponse, ReleaseCreate

router = APIRouter()


@router.get("/latest-unread", response_model=Optional[ReleaseResponse])
async def get_latest_unread_release(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Última release que o usuário ainda não marcou como lida — usada pro
    modal automático de 'seu CRM foi atualizado' ao entrar."""
    read_release_ids = select(ReleaseRead.release_id).where(ReleaseRead.user_id == current_user.id)
    query = (
        select(Release)
        .where(Release.id.not_in(read_release_ids))
        .options(selectinload(Release.notes))
        .order_by(Release.released_at.desc())
        .limit(1)
    )
    release = await db.scalar(query)
    if not release:
        return None
    return ReleaseResponse.model_validate(release, from_attributes=True)


@router.get("", response_model=List[ReleaseResponse])
async def get_releases(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Últimas releases (lidas ou não) — pro histórico dentro de Notificações."""
    query = (
        select(Release)
        .options(selectinload(Release.notes))
        .order_by(Release.released_at.desc())
        .limit(10)
    )
    result = await db.execute(query)
    releases = result.scalars().all()

    read_ids = set(
        (await db.execute(
            select(ReleaseRead.release_id).where(ReleaseRead.user_id == current_user.id)
        )).scalars().all()
    )

    responses = []
    for release in releases:
        item = ReleaseResponse.model_validate(release, from_attributes=True)
        item.is_read = release.id in read_ids
        responses.append(item)
    return responses


@router.post("", response_model=ReleaseResponse, status_code=201)
async def create_release(
    payload: ReleaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"])),
):
    existing = await db.scalar(select(Release).where(Release.version == payload.version))
    if existing:
        raise HTTPException(status_code=400, detail="Já existe uma versão com esse número.")

    release = Release(version=payload.version)
    release.notes = [
        ReleaseNote(system_name=n.system_name, description=n.description, sort_order=i)
        for i, n in enumerate(payload.notes)
    ]
    db.add(release)
    await db.commit()
    await db.refresh(release, attribute_names=["notes"])
    return ReleaseResponse.model_validate(release, from_attributes=True)


@router.delete("/{release_id}", status_code=204)
async def delete_release(
    release_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"])),
):
    release = await db.get(Release, release_id)
    if not release:
        raise HTTPException(status_code=404, detail="Release não encontrada.")
    await db.delete(release)
    await db.commit()


@router.post("/{release_id}/ler", status_code=204)
async def mark_release_read(
    release_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    existing = await db.scalar(
        select(ReleaseRead).where(
            ReleaseRead.release_id == release_id,
            ReleaseRead.user_id == current_user.id,
        )
    )
    if not existing:
        db.add(ReleaseRead(release_id=release_id, user_id=current_user.id))
        await db.commit()
