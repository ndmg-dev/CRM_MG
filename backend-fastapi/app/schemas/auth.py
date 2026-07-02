from pydantic import BaseModel
from app.schemas.user import UsuarioResponse

class GoogleLoginRequest(BaseModel):
    id_token: str

class AuthResponse(BaseModel):
    token: str
    usuario: UsuarioResponse
