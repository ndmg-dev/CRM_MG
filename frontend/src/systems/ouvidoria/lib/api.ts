// Cliente do proxy FastAPI da Ouvidoria — cobre só o que precisa de segredo
// server-side (webhooks n8n + embeddings OpenAI). Todo o resto (CRUD de
// manifestações/mensagens/notas/anexos) fala direto com o Supabase da
// Ouvidoria via ../lib/supabase.ts, protegido pelo RLS da migration
// 00001_sso_and_rls.sql — não passa por aqui.
//
// Autenticação: Bearer do PRÓPRIO CRM (`crm_token`), só pra confirmar que a
// pessoa está logada no CRM — NÃO é o token de sessão do Supabase da
// Ouvidoria (esse já viaja sozinho via supabase-js). Mesmo padrão de
// frontend/src/systems/dashboard-dre/lib/api.ts (dreFetch).
const OUVIDORIA_PROXY_BASE = '/api/v1/ouvidoria-proxy'

async function ouvidoriaProxyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('crm_token')
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${OUVIDORIA_PROXY_BASE}${path}`, { ...options, headers })

  // Mesmo tratamento de sessão expirada do resto do CRM (ver src/lib/api.ts
  // e dashboard-dre/lib/api.ts). Note: isso desloga do CRM inteiro, não só
  // da Ouvidoria — mas se o crm_token expirou, o resto do CRM também não
  // funcionaria mais mesmo.
  if (res.status === 401) {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    window.location.href = '/login'
    throw new Error('Sessão expirada')
  }

  return res
}

async function ouvidoriaProxyJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await ouvidoriaProxyFetch(path, options)
  if (!res.ok) {
    let detail = `Erro ${res.status}`
    try {
      const body = await res.json()
      detail = body?.detail || detail
    } catch {
      // resposta sem corpo JSON — mantém a mensagem genérica
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

function jsonBody(data: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
}

// ---------------------------------------------------------------------------
// Triagem de IA — dispara logo após inserir a manifestação no Supabase.
// Fire-and-forget: nunca deve travar a UI de "Nova Manifestação".
// ---------------------------------------------------------------------------

export function triageComplaint(payload: { complaint_id: string; title: string; description: string }): void {
  ouvidoriaProxyFetch('/triage', jsonBody(payload)).catch(() => {
    // Best-effort — mesmo comportamento do _fire_ai_triage original (thread
    // em background, falha nunca é reportada ao usuário).
  })
}

// ---------------------------------------------------------------------------
// Chat IRIS
// ---------------------------------------------------------------------------

export interface ChatUserPayload {
  id: string
  name: string
  email: string
}

export async function chatSend(payload: {
  session_id: string
  message: string
  user: ChatUserPayload
}): Promise<{ response: string }> {
  return ouvidoriaProxyJson('/chat/send', jsonBody(payload))
}

export type ChatStreamEvent = { token: string } | { done: true; session_id: string } | { error: string }

// Consome o SSE do proxy (`data: {...}\n\n` por linha) e chama onEvent pra
// cada token — mesmo formato que app/routes/chat.py (stream_message) já
// produzia no Flask original. Sem lib externa de EventSource porque
// precisamos mandar um Authorization header (EventSource nativo não suporta
// headers customizados).
export async function chatStream(
  payload: { session_id: string; message: string; user: ChatUserPayload },
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const res = await ouvidoriaProxyFetch('/chat/stream', jsonBody(payload))
  if (!res.ok || !res.body) {
    onEvent({ error: `O assistente não respondeu (HTTP ${res.status}).` })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Eventos SSE são separados por linha em branco ("\n\n").
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      const raw = line.slice(5).trim()
      if (!raw) continue
      try {
        onEvent(JSON.parse(raw) as ChatStreamEvent)
      } catch {
        // linha malformada — ignora e segue pro próximo evento
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Resumo de IA (painel admin)
// ---------------------------------------------------------------------------

export async function aiSummary(payload: {
  complaint_id: string
  messages: { sender_type: string; content: string }[]
}): Promise<{ summary: string }> {
  return ouvidoriaProxyJson('/ai-summary', jsonBody(payload))
}

// ---------------------------------------------------------------------------
// Base de Conhecimento (admin)
// ---------------------------------------------------------------------------

export async function knowledgeUpload(file: File, title?: string): Promise<{ message: string }> {
  const form = new FormData()
  form.append('file', file)
  if (title) form.append('title', title)
  const token = localStorage.getItem('crm_token')
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${OUVIDORIA_PROXY_BASE}/knowledge/upload`, {
    method: 'POST',
    headers,
    body: form,
  })
  if (!res.ok) {
    let detail = `Erro ${res.status}`
    try {
      const body = await res.json()
      detail = body?.detail || detail
    } catch {
      // sem corpo JSON
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function knowledgeCreate(payload: {
  title: string
  description?: string
  content?: string
  category?: string
}): Promise<{ document: Record<string, unknown>; chunks_indexed: number }> {
  return ouvidoriaProxyJson('/knowledge/create', jsonBody(payload))
}
