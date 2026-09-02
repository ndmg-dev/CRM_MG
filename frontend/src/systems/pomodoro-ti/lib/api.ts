// Cliente HTTP do Pomodoro TI. Fala com o backend do próprio CRM
// (app/api/v1/endpoints/pomodoro.py) — mesmo JWT de `crm_token` usado pelo
// resto do app (ver src/lib/api.ts), só que num cliente próprio pra não
// depender do modo mock central (padrão já usado em vps-monitor/ponto-admin).

import type { PomodoroPreferencias, PomodoroSetorState, PomodoroSetorStartInput } from './types'

const API_ROOT = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const BASE = `${API_ROOT}/pomodoro`

const snakeToCamel = (str: string) => str.replace(/([-_][a-z])/gi, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''))
const camelToSnake = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

function toCamel(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toCamel)
  return Object.keys(obj).reduce((acc, key) => {
    acc[snakeToCamel(key)] = toCamel(obj[key])
    return acc
  }, {} as any)
}

function toSnake(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toSnake)
  return Object.keys(obj).reduce((acc, key) => {
    acc[camelToSnake(key)] = toSnake(obj[key])
    return acc
  }, {} as any)
}

export class PomodoroApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'PomodoroApiError'
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('crm_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const body = options.body && typeof options.body === 'string' ? JSON.stringify(toSnake(JSON.parse(options.body))) : options.body

  const res = await fetch(`${BASE}${path}`, { ...options, headers, body, cache: 'no-store' })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new PomodoroApiError(errBody.detail || `Erro ${res.status}`, res.status)
  }
  if (res.status === 204) return {} as T
  return toCamel(await res.json()) as T
}

export const pomodoroApi = {
  getPreferencias: () => request<PomodoroPreferencias>('/preferencias'),
  putPreferencias: (data: PomodoroPreferencias) =>
    request<PomodoroPreferencias>('/preferencias', { method: 'PUT', body: JSON.stringify(data) }),
  getSetor: (setor = 'TI') => request<PomodoroSetorState>(`/setor?setor=${encodeURIComponent(setor)}`),
  iniciarSetor: (data: PomodoroSetorStartInput, setor = 'TI') =>
    request<PomodoroSetorState>(`/setor/iniciar?setor=${encodeURIComponent(setor)}`, { method: 'POST', body: JSON.stringify(data) }),
  encerrarSetor: (setor = 'TI') =>
    request<PomodoroSetorState>(`/setor/encerrar?setor=${encodeURIComponent(setor)}`, { method: 'POST' }),
}
