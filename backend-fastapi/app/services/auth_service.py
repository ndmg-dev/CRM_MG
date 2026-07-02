import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import Usuario
from app.core.config import settings

async def verify_google_access_token(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        # Hit the Google UserInfo endpoint with the access token
        response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google access token",
            )
        user_info = response.json()
        
        # Verify the domain restriction if needed
        # email = user_info.get("email")
        # if not email or not email.endswith("@mendoncagalvao.com.br"):
        #     raise HTTPException(
        #         status_code=status.HTTP_403_FORBIDDEN,
        #         detail="Access restricted to mendoncagalvao.com.br domain",
        #     )
        
        return user_info

async def authenticate_google_user(db: AsyncSession, access_token: str) -> Usuario:
    user_info = await verify_google_access_token(access_token)
    email = user_info.get("email")
    name = user_info.get("name")
    picture = user_info.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Google token does not contain email")
    if not email.endswith("@mendoncagalvao.com.br"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito ao domínio mendoncagalvao.com.br",
        )

    # Check if user exists
    user = await db.scalar(select(Usuario).where(Usuario.email == email))
    if not user:
        # Create new user as VISUALIZADOR by default (from previous logic)
        user = Usuario(
            nome=name,
            email=email,
            perfil="VISUALIZADOR",
            foto_perfil=picture,
            ativo=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif user.foto_perfil != picture or user.nome != name:
        # Update profile info
        user.foto_perfil = picture
        user.nome = name
        await db.commit()
        await db.refresh(user)

    if not user.ativo:
        raise HTTPException(status_code=400, detail="Usuário inativo")

    return user
