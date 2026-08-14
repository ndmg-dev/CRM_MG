"""Domínio do problema — tipos e protocolos.

Herdado do esboço `baixa_recibo.py`: as bordas de I/O (banco, storage) são
interfaces, e as implementações concretas ficam em `repositorio.py` e
`storage.py`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import Protocol


class MotivoRevisao(str, Enum):
    EMPRESA_NAO_ENCONTRADA = "empresa_nao_encontrada"
    ENTREGA_NAO_PARAMETRIZADA = "entrega_nao_parametrizada"
    DADOS_ILEGIVEIS = "dados_ilegiveis"
    MULTIPLAS_ENTREGAS = "multiplas_entregas"  # ambiguidade: humano decide


@dataclass(frozen=True)
class DadosRecibo:
    """Identificadores extraídos do recibo — o mínimo para casar a entrega."""

    cnpj: str  # só dígitos, como na coluna `empresa.cnpj`
    obrigacao_id: str
    competencia: date  # 1º dia do mês, como na coluna `entrega.competencia`
    protocolo: str | None = None


@dataclass(frozen=True)
class Entrega:
    id: str
    empresa_id: str
    obrigacao_id: str
    competencia: date
    status: str


class Repositorio(Protocol):
    async def recibo_ja_processado(self, tenant_id: str, hash_arq: str) -> bool: ...

    async def registrar_processamento(
        self, tenant_id: str, hash_arq: str, resultado: str, entrega_id: str | None
    ) -> None: ...

    async def termos_do_tenant(self, tenant_id: str) -> dict[str, str]: ...

    async def buscar_empresa_id_por_cnpj(self, tenant_id: str, cnpj: str) -> str | None: ...

    async def buscar_entregas(
        self, tenant_id: str, empresa_id: str, obrigacao_id: str, competencia: date
    ) -> list[Entrega]: ...

    async def marcar_entregue(
        self,
        tenant_id: str,
        entrega_id: str,
        empresa_id: str,
        anexo_path: str,
        nome_arquivo: str,
        mime: str,
        bytes_arquivo: int,
        hash_recibo: str,
        protocolo: str | None,
    ) -> None: ...

    async def enfileirar_revisao(
        self,
        tenant_id: str,
        hash_arq: str,
        storage_path: str,
        motivo: MotivoRevisao,
        cnpj_lido: str | None,
        codigo_obrigacao_lido: str | None,
        competencia_lida: str | None,
    ) -> None: ...

    async def pastas_monitoradas(self) -> list[tuple[str, str]]:
        """(tenant_id, caminho) de todas as pastas ativas."""
        ...


class Storage(Protocol):
    async def salvar(
        self,
        tenant_id: str,
        empresa_id: str | None,
        conteudo: bytes,
        hash_arq: str,
        nome_arquivo: str,
        mime: str,
    ) -> str:
        """Salva no bucket PRIVADO. Retorna o path interno (não URL pública)."""
        ...
