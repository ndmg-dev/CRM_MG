"""Cifragem simétrica para segredos por cliente (chave de integração Onvio,
CPF do colaborador). Não existia nenhum mecanismo de cifragem no projeto
antes disto (ver ClientToken.token, guardado em texto plano) — esta é a
primeira coluna cifrada do backend, então centraliza aqui em vez de
duplicar Fernet(...) em cada model.

DOMINIO_ENCRYPTION_KEY é uma chave Fernet (`Fernet.generate_key()`), gerada
uma vez por ambiente e guardada fora do repositório. Nunca é a mesma chave
em dev/homologação/produção."""

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app.core.config import settings


class DominioNaoConfigurado(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=503,
            detail="Integração com o Domínio não configurada (DOMINIO_ENCRYPTION_KEY ausente).",
        )


@lru_cache
def _fernet() -> Fernet:
    if not settings.DOMINIO_ENCRYPTION_KEY:
        raise DominioNaoConfigurado()
    return Fernet(settings.DOMINIO_ENCRYPTION_KEY.encode())


def encrypt_secret(valor: str) -> bytes:
    return _fernet().encrypt(valor.encode())


def decrypt_secret(valor_cifrado: bytes) -> str:
    try:
        return _fernet().decrypt(valor_cifrado).decode()
    except InvalidToken:
        # Chave trocada ou dado corrompido — nunca deixar vazar o bytes cru.
        raise HTTPException(status_code=500, detail="Falha ao decifrar segredo da integração Domínio.")


def mask_cpf(cpf_digits: str) -> str:
    """'12345678901' -> '***.456.789-**' — só os 6 dígitos do meio ficam
    visíveis, igual ao padrão descrito em integracao-dominio.md §8.3."""
    digits = "".join(c for c in cpf_digits if c.isdigit())
    if len(digits) != 11:
        return "***.***.***-**"
    return f"***.{digits[3:6]}.{digits[6:9]}-**"
