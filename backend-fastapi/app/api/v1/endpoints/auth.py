from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import create_access_token, get_current_user
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
    # Claim adicional (email) além do `sub` padrão: permite que backends de
    # sistemas satélite (ex: ContAI) validem o JWT do CRM sem precisar
    # consultar o Postgres do CRM — só decodificam com o JWT_SECRET compartilhado.
    token = create_access_token(subject=user.id, extra_claims={"email": user.email})

    # Create a session record for audit tracking
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

    return AuthResponse(token=token, usuario=user)

@router.get("/me", response_model=UsuarioResponse)
async def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user
