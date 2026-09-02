from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.db.session import get_db
from app.core.security import get_current_user, get_current_session, require_roles
from app.models.user import Usuario
from app.models.user_session import UserSession
from app.schemas.audit import UserSessionResponse, UserSessionActiveResponse
from app.schemas.common import PaginatedResponse

router = APIRouter()


@router.post("/heartbeat")
async def heartbeat(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    session: Optional[UserSession] = Depends(get_current_session),
):
    forwarded_for = request.headers.get("x-forwarded-for")
    real_ip = request.headers.get("x-real-ip")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    elif real_ip:
        ip_address = real_ip
    else:
        ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:512]

    # A sessão do próprio token (criada no login, ver auth.py) é a que
    # recebe o heartbeat — antes disso existir, o heartbeat "adivinhava"
    # pegando a sessão mais recente do usuário, o que confundia presença
    # entre abas/dispositivos diferentes logados ao mesmo tempo. Só cai no
    # find-or-create de antes pra token legado sem `jti` (ver
    # get_current_session), até ele expirar sozinho.
    if session is None:
        result = await db.execute(
            select(UserSession)
            .where(
                and_(
                    UserSession.usuario_id == current_user.id,
                    UserSession.ativa == True,
                )
            )
            .order_by(UserSession.inicio.desc())
            .limit(1)
        )
        session = result.scalar_one_or_none()
        if session is None:
            session = UserSession(usuario_id=current_user.id)
            db.add(session)

    session.ultima_atividade = datetime.utcnow()
    session.ip_address = ip_address
    if not session.user_agent:
        session.user_agent = user_agent

    await db.commit()
    return {"ok": True}


@router.put("/{session_id}/encerrar")
async def encerrar_sessao(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"])),
):
    """Mata uma sessão específica de longe — o dono dela leva 401 na próxima
    request/heartbeat (get_current_user rejeita `ativa=False`) e cai pra tela
    de login, sem precisar desativar a conta inteira dele."""
    session = await db.scalar(select(UserSession).where(UserSession.id == session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    session.ativa = False
    session.fim = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.get("/ativas", response_model=list[UserSessionActiveResponse])
async def get_sessoes_ativas(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"])),
):
    threshold = datetime.utcnow() - timedelta(minutes=3)

    result = await db.execute(
        select(
            UserSession,
            Usuario.nome.label("usuario_nome"),
            Usuario.email.label("usuario_email"),
            Usuario.perfil.label("usuario_perfil"),
            Usuario.setor.label("usuario_setor"),
            Usuario.foto_perfil.label("usuario_foto_perfil"),
        )
        .join(Usuario, Usuario.id == UserSession.usuario_id)
        .where(
            and_(
                UserSession.ativa == True,
                UserSession.ultima_atividade >= threshold,
            )
        )
        .order_by(UserSession.ultima_atividade.desc())
    )
    rows = result.all()

    sessions = []
    for row in rows:
        s = row[0]
        sessions.append(
            UserSessionActiveResponse(
                id=s.id,
                usuario_id=s.usuario_id,
                inicio=s.inicio,
                ultima_atividade=s.ultima_atividade,
                fim=s.fim,
                ip_address=s.ip_address,
                user_agent=s.user_agent,
                ativa=s.ativa,
                usuario_nome=row.usuario_nome,
                usuario_email=row.usuario_email,
                usuario_perfil=row.usuario_perfil,
                usuario_setor=row.usuario_setor,
                usuario_foto_perfil=row.usuario_foto_perfil,
            )
        )
    return sessions


@router.get("/historico", response_model=PaginatedResponse[UserSessionResponse])
async def get_historico_sessoes(
    usuarioId: Optional[UUID] = None,
    dataInicio: Optional[str] = None,
    dataFim: Optional[str] = None,
    page: int = 0,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"])),
):
    query = (
        select(
            UserSession,
            Usuario.nome.label("usuario_nome"),
        )
        .join(Usuario, Usuario.id == UserSession.usuario_id)
    )

    if usuarioId:
        query = query.where(UserSession.usuario_id == usuarioId)
    if dataInicio:
        query = query.where(UserSession.inicio >= datetime.fromisoformat(dataInicio))
    if dataFim:
        query = query.where(UserSession.inicio <= datetime.fromisoformat(dataFim))

    count_query = select(func.count()).select_from(query.subquery())
    total_elements = await db.scalar(count_query)

    query = query.order_by(UserSession.inicio.desc()).offset(page * size).limit(size)
    result = await db.execute(query)
    rows = result.all()

    content = []
    for row in rows:
        s = row[0]
        content.append(
            UserSessionResponse(
                id=s.id,
                usuario_id=s.usuario_id,
                inicio=s.inicio,
                ultima_atividade=s.ultima_atividade,
                fim=s.fim,
                ip_address=s.ip_address,
                user_agent=s.user_agent,
                ativa=s.ativa,
                usuario_nome=row.usuario_nome,
            )
        )

    total_pages = (total_elements + size - 1) // size if total_elements > 0 else 0

    return PaginatedResponse(
        content=content,
        totalElements=total_elements,
        totalPages=total_pages,
        page=page,
        size=size,
    )
