// Backend próprio (Next.js/Vercel) do Dashboard DRE continua hospedado à
// parte — só o frontend foi trazido pro CRM. Diferente do Guia DP, aqui há
// dado financeiro real de cliente, e a API original é protegida por uma
// senha HTTP Basic (DASHBOARD_SENHA) que não pode chegar no navegador — por
// isso a chamada passa pelo proxy do backend do CRM (que injeta a senha
// server-side) em vez de ir direto pro Vercel. Ver
// backend-fastapi/app/api/v1/endpoints/dre_proxy.py.
//
// A base tem que ser a URL ABSOLUTA do backend (VITE_API_BASE_URL, igual
// src/lib/api.ts) — em produção o nginx do frontend não roteia /api pro
// backend, então um caminho relativo cai no fallback do SPA e volta o
// index.html do CRM em vez do JSON.
const API_ROOT = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const DRE_PROXY_BASE = `${API_ROOT}/dre-proxy`

export async function dreFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('crm_token')
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${DRE_PROXY_BASE}${path}`, { ...options, headers })

  // Mesmo tratamento de sessão expirada do resto do CRM (ver src/lib/api.ts).
  if (res.status === 401) {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    window.location.href = '/login'
    throw new Error('Sessão expirada')
  }

  return res
}
