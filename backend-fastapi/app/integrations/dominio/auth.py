"""OAuth2 client_credentials contra auth.thomsonreuters.com. O token é
reutilizado pelo ERP inteiro — não um por empresa/colaborador
(INTEGRACAO_DOMINIO_FOLHA_API.md §4) — por isso o cache é em memória do
processo, num singleton, com lock pra evitar renovações concorrentes
duplicadas quando o token expira sob carga."""

import asyncio
import time

import httpx

from app.core.config import settings
from app.integrations.dominio.exceptions import raise_for_status

_MARGEM_EXPIRACAO_SEGUNDOS = 30


class DominioTokenProvider:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._token: str | None = None
        self._expires_at: float = 0.0

    async def get_access_token(self) -> str:
        if settings.DOMINIO_API_MOCK:
            return "mock-access-token"

        async with self._lock:
            if self._token and time.monotonic() < self._expires_at - _MARGEM_EXPIRACAO_SEGUNDOS:
                return self._token
            await self._renovar()
            return self._token

    async def _renovar(self) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                settings.DOMINIO_AUTH_URL,
                auth=(settings.DOMINIO_CLIENT_ID, settings.DOMINIO_CLIENT_SECRET),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.DOMINIO_CLIENT_ID,
                    "client_secret": settings.DOMINIO_CLIENT_SECRET,
                    "audience": settings.DOMINIO_AUDIENCE,
                },
            )
        raise_for_status(resp)
        data = resp.json()
        self._token = data["access_token"]
        self._expires_at = time.monotonic() + float(data.get("expires_in", 3600))

    def invalidar(self) -> None:
        """Chamado depois de um 401 — força renovação na próxima chamada,
        em vez de reusar um token que acabamos de descobrir que é inválido."""
        self._token = None
        self._expires_at = 0.0


# Singleton: o cache de token é por processo, nunca por request.
token_provider = DominioTokenProvider()
