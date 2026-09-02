import jwt
from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.db.session import get_db
from app.models.user import Usuario
from app.models.user_session import UserSession

security = HTTPBearer()

def create_access_token(
    subject: str | Any, expires_delta: timedelta = None, extra_claims: dict | None = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            seconds=settings.JWT_EXPIRATION_SECONDS
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    if extra_claims:
        to_encode.update(extra_claims)
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except (jwt.PyJWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


async def _load_session(db: AsyncSession, payload: dict) -> Optional[UserSession]:
    """Resolve a UserSession a partir do claim `jti` do token — é o que
    permite revogar UM login específico (sem precisar desativar a conta
    inteira do usuário) invalidando essa linha no banco, mesmo com o JWT
    ainda dentro do prazo de validade.

    `jti` pode estar ausente em tokens emitidos antes dessa mudança (janela
    de até 24h após o deploy, já que JWT_EXPIRATION_SECONDS é 24h) — esses
    tokens legados passam sem checagem de sessão, só a validade normal do
    JWT vale pra eles, até expirarem sozinhos."""
    jti = payload.get("jti")
    if not jti:
        return None
    try:
        session_id = UUID(jti)
    except ValueError:
        return None
    return await db.scalar(select(UserSession).where(UserSession.id == session_id))


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: HTTPAuthorizationCredentials = Depends(security)
) -> Usuario:
    payload = _decode_token(token.credentials)
    token_data = payload.get("sub")
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    if "jti" in payload:
        session = await _load_session(db, payload)
        if session is None or not session.ativa:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sessão encerrada. Faça login novamente.",
            )

    user = await db.scalar(select(Usuario).where(Usuario.id == token_data))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.ativo:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


async def get_current_session(
    db: AsyncSession = Depends(get_db),
    token: HTTPAuthorizationCredentials = Depends(security),
) -> Optional[UserSession]:
    """Pra endpoints que precisam da sessão em si (logout, heartbeat), não só
    do usuário. Retorna None pra tokens legados sem `jti` (ver _load_session)
    — quem chama decide o que fazer nesse caso (heartbeat cria uma sessão
    nova; logout simplesmente não tem o que revogar server-side)."""
    payload = _decode_token(token.credentials)
    return await _load_session(db, payload)

def require_roles(roles: list[str]):
    async def role_checker(current_user: Usuario = Depends(get_current_user)) -> Usuario:
        if current_user.perfil not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker
