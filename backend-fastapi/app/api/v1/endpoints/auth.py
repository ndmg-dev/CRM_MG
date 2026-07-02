from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import create_access_token, get_current_user
from app.models.user import Usuario
from app.schemas.auth import GoogleLoginRequest, AuthResponse
from app.schemas.user import UsuarioResponse
from app.services.auth_service import authenticate_google_user

router = APIRouter()

@router.post("/google", response_model=AuthResponse)
async def login_with_google(request: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    # request.id_token actually contains the Google access_token due to frontend implicit grant
    user = await authenticate_google_user(db, request.id_token)
    token = create_access_token(subject=user.id)
    return AuthResponse(token=token, usuario=user)

@router.get("/me", response_model=UsuarioResponse)
async def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user
