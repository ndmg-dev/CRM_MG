import asyncio

from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import Usuario


async def verify_google_id_token(token: str) -> dict:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth não está configurado no servidor",
        )

    try:
        user_info = await asyncio.to_thread(
            google_id_token.verify_oauth2_token,
            token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google ID token inválido",
        )

    if not user_info.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="O e-mail Google ainda não foi verificado",
        )
    return user_info


async def authenticate_google_user(db: AsyncSession, token: str) -> Usuario:
    user_info = await verify_google_id_token(token)
    email = user_info.get("email")
    name = user_info.get("name") or (email.split("@", 1)[0] if email else None)
    picture = user_info.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Google token não contém e-mail")

    allowed_domain = settings.GOOGLE_ALLOWED_DOMAIN.strip().lower()
    allowed_emails = {item.strip().lower() for item in settings.GOOGLE_ALLOWED_EMAILS}
    if allowed_domain and not (
        email.lower().endswith(f"@{allowed_domain}") or email.lower() in allowed_emails
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acesso restrito ao domínio {allowed_domain}",
        )

    user = await db.scalar(select(Usuario).where(Usuario.email == email))
    if not user:
        user = Usuario(
            nome=name,
            email=email,
            perfil="VISUALIZADOR",
            foto_perfil=picture,
            ativo=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif user.foto_perfil != picture or user.nome != name:
        user.foto_perfil = picture
        user.nome = name
        await db.commit()
        await db.refresh(user)

    if not user.ativo:
        raise HTTPException(status_code=403, detail="Usuário inativo")

    return user
