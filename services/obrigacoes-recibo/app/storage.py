"""Implementação do Storage sobre o Supabase Storage (bucket privado)."""

from __future__ import annotations

import logging
import re
import unicodedata
import uuid

import httpx

logger = logging.getLogger("recibo.storage")

# Espelha o `nomeSeguro` do frontend (lib/arquivo.ts): o nome vindo do arquivo
# na pasta não pode virar caminho inesperado no objeto.
_INVALIDO = re.compile(r"[^\w.\- ]")


def nome_seguro(nome: str) -> str:
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", nome) if unicodedata.category(c) != "Mn"
    )
    limpo = _INVALIDO.sub("_", sem_acento)
    limpo = re.sub(r"\s+", "_", limpo)
    limpo = re.sub(r"\.{2,}", ".", limpo)
    return limpo[-120:] or "recibo"


class StorageSupabase:
    def __init__(self, url: str, service_key: str, bucket: str) -> None:
        self._base = url.rstrip("/")
        self._bucket = bucket
        self._headers = {
            "Authorization": f"Bearer {service_key}",
            # Não sobrescrever: cada recibo entra uma vez. Colisão significa
            # reprocessamento, e aí a idempotência já barrou antes.
            "x-upsert": "false",
        }

    async def salvar(
        self,
        tenant_id: str,
        empresa_id: str | None,
        conteudo: bytes,
        hash_arq: str,
        nome_arquivo: str,
        mime: str,
    ) -> str:
        """Sobe para o bucket PRIVADO e devolve o path interno.

        Convenção de caminho `<tenant>/<empresa>/<uuid>-<nome>`: é dela que as
        policies do storage derivam o isolamento. Recibo cuja empresa não foi
        identificada vai para `_sem_empresa`, que nenhuma sessão de cliente
        consegue ler (o 2º segmento nunca casa com um empresa_id).
        """
        pasta_empresa = empresa_id or "_sem_empresa"
        caminho = f"{tenant_id}/{pasta_empresa}/{uuid.uuid4()}-{nome_seguro(nome_arquivo)}"

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self._base}/storage/v1/object/{self._bucket}/{caminho}",
                headers={**self._headers, "Content-Type": mime},
                content=conteudo,
            )

        if resp.status_code >= 400:
            # Não loga o corpo: pode devolver trecho do arquivo.
            raise RuntimeError(
                f"upload falhou status={resp.status_code} hash={hash_arq[:12]}"
            )

        return caminho

    async def remover(self, caminho: str) -> None:
        """Usado para não deixar objeto órfão quando o registro no banco falha."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                await client.delete(
                    f"{self._base}/storage/v1/object/{self._bucket}/{caminho}",
                    headers=self._headers,
                )
        except Exception:
            logger.warning("falha ao remover objeto órfão", exc_info=False)
