"""Processamento de um recibo — o núcleo, idempotente e sem efeitos surpresa.

LGPD: nada aqui loga conteúdo do arquivo, nem `nome + CNPJ` juntos. Só hash
truncado e id de entrega.
"""

from __future__ import annotations

import hashlib
import logging

from .dominio import MotivoRevisao, Repositorio, Storage
from .parser import extrair_dados

logger = logging.getLogger("recibo.processa")

_MIME_POR_EXTENSAO = {".pdf": "application/pdf", ".xml": "application/xml"}


def mime_de(nome_arquivo: str) -> str:
    for ext, mime in _MIME_POR_EXTENSAO.items():
        if nome_arquivo.lower().endswith(ext):
            return mime
    return "application/octet-stream"


async def processar_recibo(
    conteudo: bytes,
    nome_arquivo: str,
    tenant_id: str,
    repo: Repositorio,
    storage: Storage,
) -> str:
    """Processa um recibo e devolve um resultado legível para log/telemetria.

    Nunca lança para o loop do watcher: falha de um arquivo não derruba a fila.
    """
    hash_arq = hashlib.sha256(conteudo).hexdigest()
    mime = mime_de(nome_arquivo)

    # 1. Idempotência — o mesmo recibo duas vezes não baixa duas vezes.
    if await repo.recibo_ja_processado(tenant_id, hash_arq):
        logger.info("recibo já processado hash=%s", hash_arq[:12])
        return "duplicado"

    termos = await repo.termos_do_tenant(tenant_id)
    if not termos:
        # De-para vazio: tudo iria para revisão em massa. Melhor não fingir
        # que processou.
        logger.warning("tenant sem de-para configurado; recibo não processado")
        return "sem_de_para"

    # 2. Extração. Ilegível -> revisão, guardando o arquivo.
    dados, parcial = extrair_dados(conteudo, nome_arquivo, termos)

    if dados is None:
        path = await storage.salvar(tenant_id, None, conteudo, hash_arq, nome_arquivo, mime)
        await repo.enfileirar_revisao(
            tenant_id, hash_arq, path, MotivoRevisao.DADOS_ILEGIVEIS,
            parcial["cnpj"], parcial["codigo_obrigacao"], parcial["competencia"],
        )
        await repo.registrar_processamento(tenant_id, hash_arq, "revisao_ilegivel", None)
        return "revisao_ilegivel"

    # 3. Empresa DENTRO do tenant — nunca busca global por CNPJ.
    empresa_id = await repo.buscar_empresa_id_por_cnpj(tenant_id, dados.cnpj)
    if empresa_id is None:
        path = await storage.salvar(tenant_id, None, conteudo, hash_arq, nome_arquivo, mime)
        await repo.enfileirar_revisao(
            tenant_id, hash_arq, path, MotivoRevisao.EMPRESA_NAO_ENCONTRADA,
            parcial["cnpj"], parcial["codigo_obrigacao"], parcial["competencia"],
        )
        await repo.registrar_processamento(tenant_id, hash_arq, "revisao_empresa", None)
        return "revisao_empresa"

    # 4. Casamento com a entrega parametrizada.
    entregas = await repo.buscar_entregas(
        tenant_id, empresa_id, dados.obrigacao_id, dados.competencia
    )

    if not entregas:
        path = await storage.salvar(
            tenant_id, empresa_id, conteudo, hash_arq, nome_arquivo, mime
        )
        await repo.enfileirar_revisao(
            tenant_id, hash_arq, path, MotivoRevisao.ENTREGA_NAO_PARAMETRIZADA,
            parcial["cnpj"], parcial["codigo_obrigacao"], parcial["competencia"],
        )
        await repo.registrar_processamento(tenant_id, hash_arq, "revisao_sem_entrega", None)
        return "revisao_sem_entrega"

    if len(entregas) > 1:
        # Ambiguidade real: humano escolhe. Nunca baixar no palpite.
        path = await storage.salvar(
            tenant_id, empresa_id, conteudo, hash_arq, nome_arquivo, mime
        )
        await repo.enfileirar_revisao(
            tenant_id, hash_arq, path, MotivoRevisao.MULTIPLAS_ENTREGAS,
            parcial["cnpj"], parcial["codigo_obrigacao"], parcial["competencia"],
        )
        await repo.registrar_processamento(tenant_id, hash_arq, "revisao_ambigua", None)
        return "revisao_ambigua"

    entrega = entregas[0]
    if entrega.status == "ENTREGUE":
        # Comparação com o enum do banco em MAIÚSCULA. O esboço comparava com
        # "entregue" minúsculo, o que nunca casava: a entrega seria baixada de
        # novo a cada reprocessamento.
        await repo.registrar_processamento(tenant_id, hash_arq, "ja_entregue", entrega.id)
        return "ja_entregue"

    # 5. Baixa + anexa no GED (bucket privado).
    storage_path = await storage.salvar(
        tenant_id, empresa_id, conteudo, hash_arq, nome_arquivo, mime
    )
    try:
        await repo.marcar_entregue(
            tenant_id=tenant_id,
            entrega_id=entrega.id,
            empresa_id=empresa_id,
            anexo_path=storage_path,
            nome_arquivo=nome_arquivo[:255],
            mime=mime,
            bytes_arquivo=len(conteudo),
            hash_recibo=hash_arq,
            protocolo=dados.protocolo,
        )
    except ValueError:
        # Corrida com outro worker: alguém baixou primeiro. Não é erro.
        await repo.registrar_processamento(tenant_id, hash_arq, "ja_entregue", entrega.id)
        return "ja_entregue"

    await repo.registrar_processamento(tenant_id, hash_arq, "baixado", entrega.id)
    logger.info("baixa automática entrega=%s hash=%s", entrega.id, hash_arq[:12])
    return "baixado"
