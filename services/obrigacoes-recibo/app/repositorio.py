"""Implementação do Repositorio sobre o Postgres do Supabase (asyncpg).

SEGURANÇA — leia antes de acrescentar qualquer query aqui:

Este worker conecta com `service_role`, que **bypassa RLS**. A proteção de
tenant que existe para a aplicação NÃO existe para este processo. Por isso
toda query abaixo recebe e filtra `tenant_id` explicitamente. Uma consulta
global aqui vaza dado entre escritórios sem nenhum aviso do banco.
"""

from __future__ import annotations

import logging
from datetime import date

import asyncpg

from .dominio import Entrega, MotivoRevisao

logger = logging.getLogger("recibo.repo")


class RepositorioPostgres:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    # ------------------------------------------------------- idempotência

    async def recibo_ja_processado(self, tenant_id: str, hash_arq: str) -> bool:
        row = await self._pool.fetchval(
            "select 1 from recibo_processado where tenant_id = $1 and hash_arquivo = $2",
            tenant_id,
            hash_arq,
        )
        return row is not None

    async def registrar_processamento(
        self, tenant_id: str, hash_arq: str, resultado: str, entrega_id: str | None
    ) -> None:
        await self._pool.execute(
            """
            insert into recibo_processado (tenant_id, hash_arquivo, resultado, entrega_id)
            values ($1, $2, $3, $4)
            on conflict (tenant_id, hash_arquivo) do update
              set resultado = excluded.resultado, entrega_id = excluded.entrega_id
            """,
            tenant_id,
            hash_arq,
            resultado,
            entrega_id,
        )

    # ------------------------------------------------------------ de-para

    async def termos_do_tenant(self, tenant_id: str) -> dict[str, str]:
        rows = await self._pool.fetch(
            """
            select t.termo, t.obrigacao_id::text
            from recibo_termo t
            join obrigacao o on o.id = t.obrigacao_id and o.ativa
            where t.tenant_id = $1 and t.ativo
            """,
            tenant_id,
        )
        return {r["termo"]: r["obrigacao_id"] for r in rows}

    # ------------------------------------------------------------ empresa

    async def buscar_empresa_id_por_cnpj(self, tenant_id: str, cnpj: str) -> str | None:
        # Busca DENTRO do tenant. Nunca `where cnpj = $1` sozinho: dois
        # escritórios podem atender a mesma empresa.
        row = await self._pool.fetchval(
            "select id::text from empresa where tenant_id = $1 and cnpj = $2 and ativa",
            tenant_id,
            cnpj,
        )
        return row

    # ----------------------------------------------------------- entregas

    async def buscar_entregas(
        self, tenant_id: str, empresa_id: str, obrigacao_id: str, competencia: date
    ) -> list[Entrega]:
        rows = await self._pool.fetch(
            """
            select id::text, empresa_id::text, obrigacao_id::text, competencia, status::text
            from entrega
            where tenant_id = $1
              and empresa_id = $2
              and obrigacao_id = $3
              and competencia = $4
            """,
            tenant_id,
            empresa_id,
            obrigacao_id,
            competencia,
        )
        return [
            Entrega(
                id=r["id"],
                empresa_id=r["empresa_id"],
                obrigacao_id=r["obrigacao_id"],
                competencia=r["competencia"],
                status=r["status"],
            )
            for r in rows
        ]

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
    ) -> None:
        """Baixa a entrega e registra o documento no GED, numa transação.

        Em duas chamadas separadas, uma falha no meio deixaria entrega baixada
        sem documento anexado — e ninguém saberia com base em quê ela caiu.
        """
        async with self._pool.acquire() as con:
            async with con.transaction():
                atualizadas = await con.execute(
                    """
                    update entrega
                       set status       = 'ENTREGUE',
                           entregue_em  = now(),
                           origem_baixa = 'AUTOMATICA_RECIBO',
                           anexo_path   = $3,
                           anexo_nome   = $4,
                           anexo_mime   = $5,
                           anexo_bytes  = $6,
                           recibo_hash  = $7,
                           protocolo    = $8
                     where tenant_id = $1
                       and id = $2
                       and status <> 'ENTREGUE'
                    """,
                    tenant_id,
                    entrega_id,
                    anexo_path,
                    nome_arquivo,
                    mime,
                    bytes_arquivo,
                    hash_recibo,
                    protocolo,
                )
                if atualizadas.endswith(" 0"):
                    # Corrida: outro processo baixou entre a leitura e aqui.
                    raise ValueError("entrega já estava baixada")

                await con.execute(
                    """
                    insert into documento (tenant_id, empresa_id, entrega_id, storage_path,
                                           nome_arquivo, mime, bytes, origem)
                    values ($1, $2, $3, $4, $5, $6, $7, 'RECIBO_AUTOMATICO')
                    """,
                    tenant_id,
                    empresa_id,
                    entrega_id,
                    anexo_path,
                    nome_arquivo,
                    mime,
                    bytes_arquivo,
                )

    # ------------------------------------------------------------ revisão

    async def enfileirar_revisao(
        self,
        tenant_id: str,
        hash_arq: str,
        storage_path: str,
        motivo: MotivoRevisao,
        cnpj_lido: str | None,
        codigo_obrigacao_lido: str | None,
        competencia_lida: str | None,
    ) -> None:
        await self._pool.execute(
            """
            insert into recibo_revisao (tenant_id, hash_arquivo, storage_path, motivo,
                                        cnpj_lido, codigo_obrigacao_lido, competencia_lida)
            values ($1, $2, $3, $4, $5, $6, $7)
            on conflict (tenant_id, hash_arquivo) do nothing
            """,
            tenant_id,
            hash_arq,
            storage_path,
            motivo.value,
            cnpj_lido,
            codigo_obrigacao_lido,
            competencia_lida,
        )

    # ------------------------------------------------------------- pastas

    async def pastas_monitoradas(self) -> list[tuple[str, str]]:
        rows = await self._pool.fetch(
            "select tenant_id::text, caminho from pasta_monitorada where ativa"
        )
        return [(r["tenant_id"], r["caminho"]) for r in rows]


async def criar_pool(dsn: str) -> asyncpg.Pool:
    return await asyncpg.create_pool(dsn, min_size=1, max_size=5, command_timeout=30)
