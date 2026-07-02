import json
from openai import AsyncOpenAI
from app.core.config import settings

async def validate_documents(documentos_exigidos: str, arquivos_enviados: list[str]) -> dict:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY não configurada.")
        
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    
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
    
    Retorne EXATAMENTE e APENAS um JSON no seguinte formato:
    {{
        "validados": ["item exigido 1", "item exigido 2"],
        "faltantes": ["item exigido 3"]
    }}
    """

    response = await client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "Você é um validador de documentos estrito que sempre retorna JSON válido."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.0,
        response_format={ "type": "json_object" }
    )

    result_text = response.choices[0].message.content
    try:
        return json.loads(result_text)
    except Exception as e:
        raise ValueError(f"Falha ao interpretar resposta da IA: {str(e)}")
