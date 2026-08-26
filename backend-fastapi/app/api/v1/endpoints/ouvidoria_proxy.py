import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import Usuario

logger = logging.getLogger(__name__)
router = APIRouter()

# Este proxy cobre só o que o app original (ndmg-dev/ouvidoria-mg) também
# mantinha 100% server-side: webhooks do n8n (IRIS, triagem de IA, resumo
# de IA, pipeline de upload de documento) e embeddings da OpenAI. O CRUD de
# manifestações/mensagens/notas fala DIRETO com o Supabase próprio da
# Ouvidoria a partir do navegador (RLS via SSO — ver
# frontend/src/systems/ouvidoria/lib/supabase.ts e a migration
# 00001_sso_and_rls.sql), então não passa por aqui.
#
# get_current_user só garante que quem chama já está logado no CRM. A
# gravação nas tabelas do Supabase da Ouvidoria feita por estes endpoints
# usa a service_role_key (bypassa RLS) porque são escritas de campo
# derivado (sugestão de IA, resumo de IA, chunk+embedding), nunca
# atribuídas a um usuário específico — exatamente como o Flask original.


def _require_supabase() -> tuple[str, str]:
    if not settings.OUVIDORIA_SUPABASE_URL or not settings.OUVIDORIA_SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Ouvidoria não configurada (OUVIDORIA_SUPABASE_URL/OUVIDORIA_SUPABASE_SERVICE_ROLE_KEY ausentes).",
        )
    return settings.OUVIDORIA_SUPABASE_URL, settings.OUVIDORIA_SUPABASE_SERVICE_ROLE_KEY


def _supabase_headers(service_role_key: str) -> dict:
    return {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Triagem de IA — dispara ao criar uma manifestação (ouvidoria_service.py
# create_complaint / _fire_ai_triage no repo original, aqui síncrono porque
# o front já criou o registro via Supabase antes de chamar este endpoint).
# ---------------------------------------------------------------------------

class TriageRequest(BaseModel):
    complaint_id: str
    title: str
    description: str


@router.post("/triage")
async def triage_complaint(
    body: TriageRequest,
    current_user: Usuario = Depends(get_current_user),
):
    if not settings.OUVIDORIA_N8N_TRIAGE_WEBHOOK_URL:
        # Webhook opcional — silencioso como no original (best-effort).
        return {"applied": False}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.OUVIDORIA_N8N_TRIAGE_WEBHOOK_URL,
                json={
                    "complaint_id": body.complaint_id,
                    "title": body.title,
                    "description": body.description,
                },
                timeout=30.0,
            )
        if resp.status_code != 200:
            return {"applied": False}
        data = resp.json()
    except Exception as exc:
        logger.warning("Ouvidoria: triagem de IA falhou para %s: %s", body.complaint_id, exc)
        return {"applied": False}

    update_payload = {}
    if data.get("priority"):
        update_payload["ai_suggested_priority"] = data["priority"]
    if data.get("category"):
        update_payload["ai_suggested_category"] = data["category"]

    if not update_payload:
        return {"applied": False}

    base_url, service_key = _require_supabase()
    async with httpx.AsyncClient() as client:
        await client.patch(
            f"{base_url}/rest/v1/complaints",
            params={"id": f"eq.{body.complaint_id}"},
            headers={**_supabase_headers(service_key), "Prefer": "return=minimal"},
            json=update_payload,
            timeout=15.0,
        )

    return {"applied": True, **update_payload}


# ---------------------------------------------------------------------------
# Chat IRIS — envio simples (chat_service.send_to_n8n) e streaming SSE
# (routes/chat.py stream_message). O front resolve session_id/usuário
# sozinho (já autenticado no Supabase da Ouvidoria) e persiste as mensagens
# lá direto — este endpoint só fala com o n8n.
# ---------------------------------------------------------------------------

class ChatUser(BaseModel):
    id: str
    name: str = ""
    email: str = ""


class ChatSendRequest(BaseModel):
    session_id: str
    message: str
    user: ChatUser


@router.post("/chat/send")
async def chat_send(
    body: ChatSendRequest,
    current_user: Usuario = Depends(get_current_user),
):
    webhook_url = settings.OUVIDORIA_N8N_CHAT_WEBHOOK_URL
    if not webhook_url:
        raise HTTPException(
            status_code=503,
            detail="O assistente de IA não está configurado no momento.",
        )

    payload = {
        "session_id": body.session_id,
        "user_name": body.user.name,
        "user_email": body.user.email,
        "user_id": body.user.id,
        "message": body.message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                webhook_url,
                json=payload,
                timeout=settings.OUVIDORIA_N8N_WEBHOOK_TIMEOUT,
                headers={"Accept": "application/json", "User-Agent": "CRM-MG-Ouvidoria/1.0"},
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="O assistente demorou para responder. Tente novamente.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Não foi possível conectar ao assistente.")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="O assistente não conseguiu processar sua mensagem.")

    data = resp.json()
    ai_response = (
        data.get("response") or data.get("output") or data.get("message") or data.get("text") or str(data)
    )
    return {"response": ai_response}


@router.post("/chat/stream")
async def chat_stream(
    request: Request,
    current_user: Usuario = Depends(get_current_user),
):
    body = ChatSendRequest.model_validate(await request.json())
    webhook_url = settings.OUVIDORIA_N8N_CHAT_WEBHOOK_URL
    if not webhook_url:
        raise HTTPException(
            status_code=503,
            detail="O assistente de IA não está configurado no momento.",
        )

    payload = {
        "session_id": body.session_id,
        "user": {"id": body.user.id, "name": body.user.name, "email": body.user.email},
        "message": body.message,
        "stream": True,
    }
    timeout = settings.OUVIDORIA_N8N_WEBHOOK_TIMEOUT

    # Repassa o stream do n8n como Server-Sent Events, igual ao stream_message
    # original (mesmo formato de linha `data: {...}\n\n`).
    async def event_source():
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", webhook_url, json=payload) as upstream:
                    if upstream.status_code != 200:
                        yield f"data: {json.dumps({'error': f'Webhook retornou {upstream.status_code}'})}\n\n"
                        return
                    async for chunk in upstream.aiter_text():
                        if chunk:
                            yield f"data: {json.dumps({'token': chunk})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            return
        yield f"data: {json.dumps({'done': True, 'session_id': body.session_id})}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Resumo de IA de uma manifestação (ouvidoria_service.get_ai_summary).
# ---------------------------------------------------------------------------

class AiSummaryMessage(BaseModel):
    sender_type: str = "user"
    content: str = ""


class AiSummaryRequest(BaseModel):
    complaint_id: str
    messages: list[AiSummaryMessage]


@router.post("/ai-summary")
async def ai_summary(
    body: AiSummaryRequest,
    current_user: Usuario = Depends(get_current_user),
):
    webhook_url = settings.OUVIDORIA_N8N_SUMMARY_WEBHOOK_URL
    if not webhook_url:
        raise HTTPException(status_code=503, detail="OUVIDORIA_N8N_SUMMARY_WEBHOOK_URL não configurado.")

    history = [{"role": m.sender_type, "content": m.content} for m in body.messages]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                webhook_url,
                json={"complaint_id": body.complaint_id, "messages": history},
                timeout=45.0,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="O webhook n8n não respondeu em 45 segundos (timeout).")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"n8n retornou HTTP {resp.status_code}")

    raw = resp.json()
    data = raw[0] if isinstance(raw, list) and raw else raw
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Resposta inesperada do n8n (não é JSON object).")

    summary = ""
    for field in ("summary", "text", "result", "output", "content", "resposta", "resumo"):
        val = data.get(field, "")
        if isinstance(val, str) and val.strip():
            summary = val.strip()
            break

    if not summary:
        raise HTTPException(status_code=502, detail="n8n retornou 200 mas nenhum campo de resumo encontrado.")

    base_url, service_key = _require_supabase()
    async with httpx.AsyncClient() as client:
        await client.patch(
            f"{base_url}/rest/v1/complaints",
            params={"id": f"eq.{body.complaint_id}"},
            headers={**_supabase_headers(service_key), "Prefer": "return=minimal"},
            json={"ai_summary": summary},
            timeout=15.0,
        )

    return {"summary": summary}


# ---------------------------------------------------------------------------
# Base de conhecimento — upload de arquivo (relay puro pro n8n, que cuida de
# Drive + chunking + embeddings) e criação manual (chunking + embeddings
# feitos aqui, porque exige a OPENAI_API_KEY, que nunca pode ir ao browser).
# ---------------------------------------------------------------------------

@router.post("/knowledge/upload")
async def knowledge_upload(
    request: Request,
    current_user: Usuario = Depends(get_current_user),
):
    webhook_url = settings.OUVIDORIA_N8N_KNOWLEDGE_WEBHOOK_URL
    if not webhook_url:
        raise HTTPException(status_code=503, detail="OUVIDORIA_N8N_KNOWLEDGE_WEBHOOK_URL não configurado.")

    form = await request.form()
    file = form.get("file")
    if file is None:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado.")

    title = form.get("title") or file.filename

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                webhook_url,
                files={"file": (file.filename, await file.read(), file.content_type)},
                data={
                    "uploaded_by": current_user.email,
                    "uploaded_by_name": current_user.nome or current_user.email,
                    "title": title,
                },
                timeout=60.0,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"n8n retornou status {resp.status_code}")

    return {"message": "Arquivo enviado para processamento no n8n!"}


def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 100) -> list[str]:
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end].strip())
        start += chunk_size - overlap
    return chunks


async def _get_embedding(client: httpx.AsyncClient, text: str) -> list[float] | None:
    if not settings.OPENAI_API_KEY:
        return None
    try:
        resp = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            json={"input": text, "model": "text-embedding-3-small"},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]
    except Exception as exc:
        logger.error("Ouvidoria: falha ao gerar embedding: %s", exc)
        return None


class KnowledgeCreateRequest(BaseModel):
    title: str
    description: str = ""
    content: str = ""
    category: str = ""


@router.post("/knowledge/create")
async def knowledge_create(
    body: KnowledgeCreateRequest,
    current_user: Usuario = Depends(get_current_user),
):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="O título é obrigatório.")

    base_url, service_key = _require_supabase()
    headers = _supabase_headers(service_key)

    doc_payload = {
        "title": body.title.strip(),
        "description": body.description.strip(),
        "content": body.content.strip(),
        "category": body.category.strip(),
        "status": "active",
    }

    async with httpx.AsyncClient() as client:
        insert_resp = await client.post(
            f"{base_url}/rest/v1/knowledge_documents",
            headers={**headers, "Prefer": "return=representation"},
            json=doc_payload,
            timeout=15.0,
        )
        insert_resp.raise_for_status()
        rows = insert_resp.json()
        if not rows:
            raise HTTPException(status_code=502, detail="Erro ao criar documento.")
        doc = rows[0]
        doc_id = doc["id"]

        content = doc_payload["content"]
        inserted_count = 0
        if content:
            chunks = _chunk_text(content)
            for i, chunk_text in enumerate(chunks):
                embedding = await _get_embedding(client, chunk_text)
                if embedding is None:
                    continue
                chunk_resp = await client.post(
                    f"{base_url}/rest/v1/knowledge_chunks",
                    headers=headers,
                    json={
                        "document_id": doc_id,
                        "chunk_index": i,
                        "content": chunk_text,
                        "embedding": embedding,
                        "metadata": {"title": doc_payload["title"], "category": doc_payload["category"]},
                    },
                    timeout=15.0,
                )
                if chunk_resp.status_code < 300:
                    inserted_count += 1

            if inserted_count > 0:
                await client.patch(
                    f"{base_url}/rest/v1/knowledge_documents",
                    params={"id": f"eq.{doc_id}"},
                    headers={**headers, "Prefer": "return=minimal"},
                    json={
                        "chunk_count": inserted_count,
                        "last_indexed_at": datetime.now(timezone.utc).isoformat(),
                    },
                    timeout=15.0,
                )

    return {"document": doc, "chunks_indexed": inserted_count}
