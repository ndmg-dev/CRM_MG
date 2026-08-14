"""Extração dos identificadores do recibo.

A peça difícil, e a que mais depende de arquivo real. O de-para de obrigações
NÃO está aqui: vive na tabela `recibo_termo`, para poder começar por um tipo de
recibo e expandir sem redeploy.
"""

from __future__ import annotations

import logging
import re
from datetime import date
from functools import lru_cache

from defusedxml.ElementTree import fromstring as safe_fromstring

from .dominio import DadosRecibo

logger = logging.getLogger("recibo.parser")

_RE_CNPJ = re.compile(r"\b(\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2})\b")
_RE_COMPET = re.compile(r"\b(0[1-9]|1[0-2])/(20\d{2})\b")
_RE_PROTOCOLO = re.compile(r"protocolo[:\s]+([A-Z0-9.\-]{6,})", re.IGNORECASE)

_PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
_PESOS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]


def _digito(base: str, pesos: list[int]) -> int:
    soma = sum(int(c) * p for c, p in zip(base, pesos))
    resto = soma % 11
    return 0 if resto < 2 else 11 - resto


def cnpj_valido(cnpj: str) -> bool:
    """Mesma regra da constraint `empresa_cnpj_digito_verificador`.

    Confere aqui evita ir ao banco com um número que o regex pegou no meio de
    outro campo do recibo (inscrição estadual, nº de guia).
    """
    d = re.sub(r"\D", "", cnpj or "")
    if len(d) != 14 or d == d[0] * 14:
        return False
    return int(d[12]) == _digito(d[:12], _PESOS_1) and int(d[13]) == _digito(d[:13], _PESOS_2)


def normaliza_cnpj(bruto: str) -> str:
    """Devolve só os dígitos — é assim que a coluna `empresa.cnpj` guarda."""
    return re.sub(r"\D", "", bruto or "")


@lru_cache(maxsize=512)
def _padrao_do_termo(termo: str) -> re.Pattern[str]:
    # Bordas de palavra dos DOIS lados. Sem isso, `termo in texto` casa dentro
    # de outra palavra: 'das' aparece em 'cadastrou', 'todas', 'medidas' — e o
    # recibo seria baixado como DAS. Um teste cobre exatamente esse caso.
    return re.compile(rf"(?<!\w){re.escape(termo)}(?!\w)", re.IGNORECASE)


def detecta_obrigacao(texto: str, termos: dict[str, str]) -> str | None:
    """Casa o texto do recibo com uma obrigação, via de-para do banco.

    Ordena por chave mais longa primeiro: evita 'das' vencer sobre 'pgdas-d'
    quando os dois casariam. O que não estiver no de-para devolve None e vai
    para revisão — casar por palpite é o que gera baixa errada.
    """
    for termo in sorted(termos, key=len, reverse=True):
        if _padrao_do_termo(termo).search(texto):
            return termos[termo]
    return None


def texto_de_xml(conteudo: bytes) -> str:
    """XML com parser seguro (defusedxml) — recibo é arquivo de terceiro.

    Sem isso, uma entidade externa no XML viraria leitura de arquivo do
    servidor ou requisição de rede a partir do worker (XXE).
    """
    root = safe_fromstring(conteudo)
    return " ".join(el.text or "" for el in root.iter())


def texto_de_pdf(conteudo: bytes) -> str:
    """Camada de texto do PDF.

    `pypdf` é opcional: sem ele, o PDF cai em revisão por ilegível em vez de
    derrubar o worker. PDF só de imagem (digitalizado) também cai em revisão —
    OCR aqui seria adivinhação sobre documento fiscal.
    """
    try:
        import io

        from pypdf import PdfReader

        leitor = PdfReader(io.BytesIO(conteudo))
        # Poucas páginas bastam: os identificadores ficam no cabeçalho.
        return " ".join((p.extract_text() or "") for p in leitor.pages[:5])
    except ImportError:
        logger.warning("pypdf ausente: PDFs irão para revisão manual")
        return ""
    except Exception:
        logger.warning("falha ao extrair texto do PDF", exc_info=False)
        return ""


def competencia_para_data(mm: str, aaaa: str) -> date:
    return date(int(aaaa), int(mm), 1)


def extrair_texto(conteudo: bytes, nome_arquivo: str) -> str:
    if nome_arquivo.lower().endswith(".xml"):
        return texto_de_xml(conteudo)
    if nome_arquivo.lower().endswith(".pdf"):
        return texto_de_pdf(conteudo)
    return conteudo.decode("utf-8", errors="ignore")


def extrair_dados(
    conteudo: bytes, nome_arquivo: str, termos: dict[str, str]
) -> tuple[DadosRecibo | None, dict[str, str | None]]:
    """Extrai os identificadores do recibo.

    Devolve `(dados, parcial)`. Quando `dados` é None o chamador manda para
    revisão — nunca descarta —, e `parcial` leva o que deu para ler, que é o
    que ajuda o humano a decidir na tela.
    """
    parcial: dict[str, str | None] = {
        "cnpj": None,
        "codigo_obrigacao": None,
        "competencia": None,
    }

    try:
        texto = extrair_texto(conteudo, nome_arquivo)
    except Exception:
        # Não loga o conteúdo: recibo carrega CPF e dado fiscal.
        logger.warning("arquivo ilegível arquivo=%s", nome_arquivo[:60], exc_info=False)
        return None, parcial

    if not texto.strip():
        return None, parcial

    # Primeiro CNPJ com DV válido: o regex pode pegar número de outro campo.
    cnpj = None
    for m in _RE_CNPJ.finditer(texto):
        if cnpj_valido(m.group(1)):
            cnpj = normaliza_cnpj(m.group(1))
            break
    parcial["cnpj"] = cnpj

    obrigacao_id = detecta_obrigacao(texto, termos)
    parcial["codigo_obrigacao"] = obrigacao_id

    m_comp = _RE_COMPET.search(texto)
    if m_comp:
        parcial["competencia"] = f"{m_comp.group(1)}/{m_comp.group(2)}"

    if not (cnpj and obrigacao_id and m_comp):
        return None, parcial

    m_proto = _RE_PROTOCOLO.search(texto)

    return (
        DadosRecibo(
            cnpj=cnpj,
            obrigacao_id=obrigacao_id,
            competencia=competencia_para_data(m_comp.group(1), m_comp.group(2)),
            protocolo=m_proto.group(1) if m_proto else None,
        ),
        parcial,
    )
