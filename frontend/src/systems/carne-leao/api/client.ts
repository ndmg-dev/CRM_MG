// Cliente HTTP para a API do Carnê-Leão (Flask, hospedado à parte —
// PROJETO-CARNE-LEAO, branch feat/google-drive-integration). Segue o mesmo
// padrão do ContAI (ver src/systems/contai/api/client.ts): a API exige o
// MESMO Bearer token de sessão emitido pelo CRM, reaproveitado do
// localStorage (chave 'crm_token' — ver src/stores/authStore.ts).
//
// Diferente do ContAI, esta API não usa o envelope { ok, data }: cada rota
// devolve JSON próprio (ou um erro { error: string }), e uma rota (SSE em
// /api/process) é consumida via EventSource em vez de fetch.
const API_BASE =
  import.meta.env.VITE_CARNE_LEAO_API_URL || 'http://localhost:5000'

if (!import.meta.env.VITE_CARNE_LEAO_API_URL) {
  console.warn(
    '[carne-leao] VITE_CARNE_LEAO_API_URL não configurada — usando fallback de desenvolvimento (http://localhost:5000).'
  )
}

export class CarneLeaoApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'CarneLeaoApiError'
    this.status = status
  }
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  const token = localStorage.getItem('crm_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

/** URL completa da API, com o path informado (usada para EventSource/<img>). */
export function carneLeaoUrl(path: string): string {
  return `${API_BASE}${path}`
}

/** Bearer token do CRM atual, para montar EventSource ou <img src> manualmente. */
export function getCrmToken(): string | null {
  return localStorage.getItem('crm_token')
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: authHeaders(options?.headers),
    })
  } catch {
    throw new CarneLeaoApiError('Falha de rede ao contatar a API do Carnê-Leão.', 0)
  }

  if (!res.ok) {
    let message = `Erro ${res.status} ao comunicar com a API do Carnê-Leão.`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // corpo não-JSON
    }
    throw new CarneLeaoApiError(message, res.status)
  }

  return res.json() as Promise<T>
}

export interface CarneLeaoMonth {
  month_num: string
  name: string
  total_files: number
}

export interface CarneLeaoDocument {
  id: number
  month: string
  month_num: string
  filename: string
  filepath: string
  description: string | null
  date: string | null
  value: number | null
  status: 'ok' | 'review' | 'error' | 'pending'
  confidence: 'alta' | 'media' | 'baixa' | null
  observation: string | null
  processed_at: string
  manually_edited?: number
}

export interface CarneLeaoStats {
  total: number
  ok: number
  review: number
  error: number
  pending: number
}

export const carneLeaoApi = {
  scan: () => request<{ months: CarneLeaoMonth[]; base_path: string }>('/api/scan'),

  getDocuments: (params?: { month?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.month && params.month !== 'all') qs.set('month', params.month)
    if (params?.status && params.status !== 'all') qs.set('status', params.status)
    const suffix = qs.toString() ? `?${qs}` : ''
    return request<{ documents: CarneLeaoDocument[] }>(`/api/documents${suffix}`)
  },

  getStats: () => request<CarneLeaoStats>('/api/stats'),

  updateDocument: (id: number, date: string | null, value: string | null) =>
    request<{ success: boolean; document: CarneLeaoDocument }>(`/api/document/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, value }),
    }),

  /**
   * Processa os documentos via SSE. Usa fetch + ReadableStream (em vez de
   * EventSource nativo) porque EventSource não suporta cabeçalhos
   * customizados — e precisamos anexar o Bearer token do CRM quando a API
   * exige auth (CRM_JWT_SECRET configurado no backend Flask).
   * Retorna uma função para abortar o processamento.
   */
  process: <T extends { type: string }>(
    apiKey: string,
    onEvent: (msg: T) => void,
    onDone: () => void,
    onError: (err: unknown) => void
  ): (() => void) => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/process?api_key=${encodeURIComponent(apiKey)}`,
          { headers: authHeaders(), signal: controller.signal }
        )
        if (!res.ok || !res.body) {
          throw new CarneLeaoApiError(`Erro ${res.status} ao iniciar processamento.`, res.status)
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''
          for (const part of parts) {
            const line = part.split('\n').find((l) => l.startsWith('data: '))
            if (!line) continue
            try {
              onEvent(JSON.parse(line.slice(6)) as T)
            } catch {
              // ignora eventos malformados
            }
          }
        }
        onDone()
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') onError(err)
      }
    })()
    return () => controller.abort()
  },

  /**
   * Baixa o preview e devolve um object URL — não pode ser usado como `src`
   * de <img> direto porque a rota exige Bearer token (que <img> não envia).
   */
  fetchPreview: async (id: number): Promise<string> => {
    const res = await fetch(`${API_BASE}/api/preview/${id}`, { headers: authHeaders() })
    if (!res.ok) throw new CarneLeaoApiError('Falha ao carregar preview', res.status)
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },

  exportExcel: async (documents: CarneLeaoDocument[]): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/api/export`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ documents }),
    })
    if (!res.ok) throw new CarneLeaoApiError('Erro ao gerar Excel', res.status)
    return res.blob()
  },
}
