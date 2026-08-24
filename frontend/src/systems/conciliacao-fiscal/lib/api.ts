// Backend próprio (FastAPI) do FiscalMatch continua hospedado à parte — só o
// frontend foi trazido pro CRM. Diferente do Guia DP, aqui há documento
// fiscal real de cliente (NF-e, SPED), então a API exige o token de sessão
// do próprio CRM (ver PR "feat(auth)" em ndmg-dev/FiscalMatch) — sem isso a
// chamada cross-origin ficaria tão exposta quanto a API estava antes.
const API_BASE =
  import.meta.env.VITE_FISCAL_API_BASE_URL ?? 'https://apifiscal.mendoncagalvao.com.br/api/v1'

/** fetch() com a base da API e o Bearer token do CRM já anexados. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('crm_token')
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  // Mesmo tratamento de sessão expirada do resto do CRM (ver src/lib/api.ts)
  // — antes desta API exigir o token do CRM (ver PR "feat(auth)" em
  // ndmg-dev/FiscalMatch) um 401 nunca acontecia aqui, então nada tratava.
  if (res.status === 401) {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    window.location.href = '/login'
    throw new Error('Sessão expirada')
  }

  return res
}

/**
 * Baixa um arquivo (CSV/XLSX) via fetch autenticado e dispara o download no
 * navegador. Um <a href> direto não carrega o Bearer token — desde que a API
 * passou a exigir auth, um link puro pra esses endpoints só devolveria 401.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await apiFetch(path)
  if (!res.ok) throw new Error(`Erro ${res.status} ao baixar arquivo`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
