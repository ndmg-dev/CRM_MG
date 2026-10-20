// Cliente HTTP do módulo Extratos de Sócios. Fala só com o backend do CRM
// (app/api/v1/endpoints/extratos.py) — espelho somente-leitura. Mesmo padrão
// do vps-monitor: base absoluta (VITE_API_BASE_URL), token do CRM via
// localStorage, 401 -> volta pro login.

import type { DashboardExtratos, EmpresaDetalhe, NaoVinculado } from './types'

const API_ROOT = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export class ExtratosApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ExtratosApiError'
    this.status = status
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('crm_token')
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`${API_ROOT}${path}`, { cache: 'no-store', ...init, headers })
  } catch {
    throw new ExtratosApiError('Falha de rede ao contatar o backend do CRM.', 0)
  }

  if (res.status === 401) {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    window.location.href = '/login'
    throw new ExtratosApiError('Sessão expirada', 401)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ExtratosApiError(body.detail || body.message || `Erro ${res.status}`, res.status)
  }

  return res.json() as Promise<T>
}

// Falha rápido (1 retry), como o vps-monitor: erros aqui são determinísticos
// (404/403/503), não vale re-tentar 3x.
export const extratosQueryOptions = {
  retry: 1,
  staleTime: 60_000,
} as const

export const extratosApi = {
  dashboard: (ano?: number) =>
    apiFetch<DashboardExtratos>(`/dashboard/extratos${ano ? `?ano=${ano}` : ''}`),
  empresa: (clientId: string, ano?: number) =>
    apiFetch<EmpresaDetalhe>(`/extratos/empresa/${clientId}${ano ? `?ano=${ano}` : ''}`),
  naoVinculados: () => apiFetch<NaoVinculado[]>(`/extratos/nao-vinculados`),
}
