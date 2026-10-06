"""Classificação de erro da Onvio API (INTEGRACAO_DOMINIO_FOLHA_API.md
§20). A regra de retry nunca vive espalhada pelos callers — fica só aqui,
num lugar, pra não divergir entre o fluxo de ativação e o de envio."""

import httpx

RETRYABLE_STATUS = {429, 500, 502, 503, 504}
MAX_TENTATIVAS_TRANSITORIAS = 3


class DominioApiError(Exception):
    def __init__(self, status_code: int, body: str, retryable: bool):
        self.status_code = status_code
        self.body = body
        self.retryable = retryable
        super().__init__(f"Domínio API respondeu {status_code}: {body[:200]}")


class DominioAuthError(DominioApiError):
    """401 — token inválido/expirado. Quem chama decide se renova e tenta
    de novo (uma vez só, nunca em loop)."""


def raise_for_status(resp: httpx.Response) -> None:
    if resp.status_code < 400:
        return
    if resp.status_code == 401:
        raise DominioAuthError(resp.status_code, resp.text, retryable=False)
    retryable = resp.status_code in RETRYABLE_STATUS
    raise DominioApiError(resp.status_code, resp.text, retryable=retryable)
