/// <reference types="vite/client" />

// Backend do Cronos é um serviço completamente separado (própria API, JWT,
// banco) — não roda no mesmo domínio do CRM. Todo path passado pra `api.*`
// já vem como "/api/v1/..." (herdado do app original, que rodava num
// domínio próprio com nginx fazendo proxy de /api); aqui prefixamos com a
// URL absoluta do backend.
const CRONOS_API_URL: string = import.meta.env.VITE_CRONOS_API_URL || ''

function resolveUrl(path: string): string {
  return `${CRONOS_API_URL}${path}`
}

let _redirecting = false
function handleUnauthorized() {
  if (_redirecting) return
  _redirecting = true
  localStorage.removeItem('mg_token')
  // Mantém o usuário dentro do sistema (montado em /sistemas/:id/*) em vez
  // de mandar pro /login do CRM — os dois têm autenticação independente.
  const match = window.location.pathname.match(/^(\/sistemas\/[^/]+)/)
  window.location.href = match ? `${match[1]}/login` : '/login'
}

// FastAPI erros de validação (422) retornam `detail` como uma lista de objetos
// ({ loc, msg, type }), não uma string — sem isso, `new Error(detail)` vira "[object Object]".
export function extractErrorDetail(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map(d => (d && typeof d === 'object' && 'msg' in d) ? String((d as { msg: unknown }).msg) : String(d))
      .join('; ')
  }
  return fallback
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('mg_token')
  const resp = await fetch(resolveUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (resp.status === 401) {
    handleUnauthorized()
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorDetail(err, 'Erro desconhecido'))
  }
  if (resp.status === 204) return undefined as T
  return resp.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export async function uploadAttachment(path: string, file: File): Promise<{ attachment_url: string }> {
  const token = localStorage.getItem('mg_token')
  const form = new FormData()
  form.append('file', file)
  // Sem Content-Type explícito: o browser define multipart/form-data com o
  // boundary correto sozinho quando o body é um FormData.
  const resp = await fetch(resolveUrl(path), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (resp.status === 401) {
    handleUnauthorized()
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorDetail(err, 'Erro ao enviar anexo'))
  }
  return resp.json()
}

export async function downloadCsv(path: string, filename: string) {
  const token = localStorage.getItem('mg_token')
  const resp = await fetch(resolveUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const blob = await resp.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function openAttachment(path: string) {
  // Anexos agora exigem Authorization (endpoint autenticado, não mais
  // StaticFiles público) — um <a href> puro não manda o header, então
  // busca via fetch e abre o blob numa aba nova (visualização, não download
  // forçado como downloadBlob faz).
  const token = localStorage.getItem('mg_token')
  const resp = await fetch(resolveUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (resp.status === 401) {
    handleUnauthorized()
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  if (!resp.ok) {
    throw new Error('Não foi possível abrir o anexo.')
  }
  const blob = await resp.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadBlob(path: string, filename: string) {
  const token = localStorage.getItem('mg_token')
  const resp = await fetch(resolveUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (resp.status === 401) {
    handleUnauthorized()
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorDetail(err, 'Erro ao exportar'))
  }
  const blob = await resp.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
