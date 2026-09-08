from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import create_access_token, get_current_user, get_current_session
from app.models.user import Usuario
from app.models.user_session import UserSession
from app.schemas.auth import GoogleLoginRequest, AuthResponse
from app.schemas.user import UsuarioResponse
from app.services.auth_service import authenticate_google_user

router = APIRouter()

@router.post("/google", response_model=AuthResponse)
async def login_with_google(
    body: GoogleLoginRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    # body.id_token actually contains the Google access_token due to frontend implicit grant
    user = await authenticate_google_user(db, body.id_token)

    # Sessão criada ANTES do token — o id dela vira o claim `jti`, é o que
    # permite revogar ESTE login específico depois (POST /auth/logout, ou um
    # admin encerrando de longe em PUT /sessoes/{id}/encerrar) sem precisar
    # desativar a conta inteira do usuário.
    forwarded_for = http_request.headers.get("x-forwarded-for")
    real_ip = http_request.headers.get("x-real-ip")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    elif real_ip:
        ip_address = real_ip
    else:
        ip_address = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent", "")[:512]
    session = UserSession(
        usuario_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Claims adicionais além do `sub` padrão:
    # - email: permite que backends de sistemas satélite (ex: ContAI) validem
    #   o JWT do CRM sem precisar consultar o Postgres do CRM.
    # - jti: id da UserSession acima (ver get_current_user/_load_session).
    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "jti": str(session.id)},
    )

    return AuthResponse(token=token, usuario=user)

@router.get("/me", response_model=UsuarioResponse)
async def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user

@router.post("/logout")
async def logout(
    db: AsyncSession = Depends(get_db),
    session: UserSession = Depends(get_current_session),
):
    # Token legado sem `jti` (ver get_current_session): não tem sessão pra
    # revogar server-side, mas isso não é erro — o front já limpa o token
    # local independente da resposta daqui, e o próprio JWT expira sozinho
    # (24h no máximo).
    if session is not None:
        session.ativa = False
        session.fim = datetime.utcnow()
        await db.commit()
    return {"ok": True}
