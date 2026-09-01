// Cliente HTTP do Monitoramento da VPS. Fala SÓ com o backend do CRM
// (app/api/v1/endpoints/vps_monitor.py), que injeta o token da Hostinger
// server-side e faz cache. O navegador nunca vê o token nem a API da
// Hostinger.
//
// Lições da saga do dre_proxy (ver docs/monitoramento-vps/handoff.md §8.5):
//  - base = VITE_API_BASE_URL ABSOLUTA. O nginx do frontend não roteia /api,
//    então um caminho relativo cai no fallback do SPA e volta o index.html.
//  - cache: 'no-store'. O backend agrega/transforma (não é proxy puro), mas
//    não custa nada garantir que o navegador não sirva resposta velha.

import type {
  ActionsResponse,
  BackupsResponse,
  FirewallResponse,
  MetricsResponse,
  Monarx,
  Overview,
  SnapshotView,
  Vm,
} from './types'

const API_ROOT = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const VPS_BASE = `${API_ROOT}/vps`

export class VpsApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'VpsApiError'
    this.status = status
  }
}

async function vpsFetch<T>(path: string): Promise<T> {
  const token = localStorage.getItem('crm_token')
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`${VPS_BASE}${path}`, { cache: 'no-store', headers })
  } catch {
    throw new VpsApiError('Falha de rede ao contatar o backend do CRM.', 0)
  }

  if (res.status === 401) {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    window.location.href = '/login'
    throw new VpsApiError('Sessão expirada', 401)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new VpsApiError(body.detail || body.message || `Erro ${res.status}`, res.status)
  }

  return res.json() as Promise<T>
}

// Opções padrão dos useQuery do painel: falha rápido (1 retry) em vez de
// deixar o usuário num spinner por ~10s enquanto o react-query re-tenta 3x
// um erro determinístico (token ausente = 503, rota inexistente = 404).
export const vpsQueryOptions = {
  retry: 1,
  staleTime: 30_000,
} as const

export const vpsApi = {
  overview: () => vpsFetch<Overview>('/overview'),
  vm: () => vpsFetch<Vm>('/vm'),
  metrics: (range: '24h' | '7d' | '30d') => vpsFetch<MetricsResponse>(`/metrics?range=${range}`),
  snapshot: () => vpsFetch<SnapshotView>('/snapshot'),
  backups: () => vpsFetch<BackupsResponse>('/backups'),
  actions: (page = 1) => vpsFetch<ActionsResponse>(`/actions?page=${page}`),
  firewall: () => vpsFetch<FirewallResponse>('/firewall'),
  monarx: () => vpsFetch<Monarx>('/monarx'),
}
