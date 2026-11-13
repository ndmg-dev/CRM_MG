import json

from anthropic import AsyncAnthropic
from pydantic import BaseModel

from app.core.config import settings


class ValidacaoDocumentos(BaseModel):
    """Esquema estrito da resposta da IA (structured outputs)."""

    validados: list[str]
    faltantes: list[str]


async def validate_documents(documentos_exigidos: str, arquivos_enviados: list[str]) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY não configurada.")

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    prompt = f"""
    Você é um assistente de contabilidade inteligente.
    Sua tarefa é validar os documentos enviados pelo cliente contra a lista de documentos exigidos.

    Documentos Exigidos:
    {documentos_exigidos}

    Arquivos Enviados (Nomes):
    {json.dumps(arquivos_enviados, ensure_ascii=False)}

    Instruções:
    1. Analise a semântica dos nomes dos arquivos enviados e tente correlacioná-los com a lista de exigidos.
    2. Liste em "validados" os itens exigidos que você identificou nos arquivos.
    3. Liste em "faltantes" os itens exigidos que NÃO foram encontrados.
    """

    try:
        response = await client.messages.parse(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4096,
            system="Você é um validador de documentos estrito que sempre retorna JSON válido.",
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": prompt}],
            output_format=ValidacaoDocumentos,
        )
    except Exception as e:
        raise ValueError(f"Falha ao consultar a IA: {str(e)}")

    resultado = response.parsed_output
    if resultado is None:
        raise ValueError("A IA não retornou uma resposta válida.")

    return resultado.model_dump()
