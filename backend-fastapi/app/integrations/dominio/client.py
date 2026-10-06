"""Cliente HTTP da Onvio API — os três endpoints documentados em
INTEGRACAO_DOMINIO_FOLHA_API.md §3. Em modo mock (DOMINIO_API_MOCK, ligado
por padrão) nenhuma chamada de rede acontece; as respostas são as de
exemplo do próprio documento (§23), pra dar pra desenvolver e testar a UI/
fluxo sem credencial nenhuma."""

import httpx

from app.core.config import settings
from app.integrations.dominio.auth import token_provider
from app.integrations.dominio.exceptions import DominioAuthError, raise_for_status
from app.integrations.dominio.schemas import DominioPayslipItemRequest

_ACTIVATION_INFO_PATH = "/dominio/integration/v1/activation/info"
_ACTIVATION_ENABLE_PATH = "/dominio/integration/v1/activation/enable"
_PAYSLIP_ITEM_PATH = "/dominio/partner-data/v1/partner-data/payslip-item-inclusion"

_MOCK_ACTIVATION_INFO = {
    "accountingOfficeName": "ESCRITORIO TESTE",
    "clientName": "EMPRESA TESTE LTDA",
    "clientDocument": "00.000.000/0001-00",
}
_MOCK_ENABLE = {"integrationKey": "mock-integration-key"}


class DominioApiClient:
    """Uma instância por chamada, parametrizada pela integration_key do
    cliente — nunca compartilhada entre clientes-empresa diferentes."""

    def __init__(self, integration_key: str | None = None):
        self.integration_key = integration_key

    async def get_activation_info(self, activation_key: str) -> dict:
        if settings.DOMINIO_API_MOCK:
            return dict(_MOCK_ACTIVATION_INFO)
        token = await token_provider.get_access_token()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await self._get_com_renovacao(
                client, "GET", _ACTIVATION_INFO_PATH, token, activation_key
            )
        return resp.json()

    async def enable_activation(self, activation_key: str) -> dict:
        if settings.DOMINIO_API_MOCK:
            return dict(_MOCK_ENABLE)
        token = await token_provider.get_access_token()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await self._get_com_renovacao(
                client, "POST", _ACTIVATION_ENABLE_PATH, token, activation_key
            )
        return resp.json()

    async def send_payslip_item(self, payload: DominioPayslipItemRequest) -> dict | None:
        """Retorna None em sucesso mock/sem corpo (§3: "a resposta de
        sucesso pode não possuir body"), ou o JSON devolvido quando houver."""
        if settings.DOMINIO_API_MOCK:
            return None
        if not self.integration_key:
            raise ValueError("integration_key é obrigatória fora do modo mock")
        token = await token_provider.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Integration-Key": self.integration_key,
            "Client-id": settings.DOMINIO_CLIENT_ID,
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.post(
                    f"{settings.DOMINIO_API_BASE_URL}{_PAYSLIP_ITEM_PATH}",
                    headers=headers,
                    json=payload.to_payload(),
                )
                raise_for_status(resp)
            except DominioAuthError:
                # 401: renova uma vez e tenta de novo — nunca em loop (§20).
                token_provider.invalidar()
                headers["Authorization"] = f"Bearer {await token_provider.get_access_token()}"
                resp = await client.post(
                    f"{settings.DOMINIO_API_BASE_URL}{_PAYSLIP_ITEM_PATH}",
                    headers=headers,
                    json=payload.to_payload(),
                )
                raise_for_status(resp)
        if not resp.content:
            return None
        return resp.json()

    async def _get_com_renovacao(
        self, client: httpx.AsyncClient, method: str, path: str, token: str, activation_key: str
    ) -> httpx.Response:
        headers = {"Authorization": f"Bearer {token}", "x-integration-key": activation_key}
        try:
            resp = await client.request(method, f"{settings.DOMINIO_API_BASE_URL}{path}", headers=headers)
            raise_for_status(resp)
        except DominioAuthError:
            token_provider.invalidar()
            headers["Authorization"] = f"Bearer {await token_provider.get_access_token()}"
            resp = await client.request(method, f"{settings.DOMINIO_API_BASE_URL}{path}", headers=headers)
            raise_for_status(resp)
        return resp
