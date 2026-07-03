/**
 * API Client for CRM Mendonça Galvão
 *
 * Toggle between MOCK and REAL backend mode:
 *   - Set VITE_USE_MOCK=true in .env for standalone demo (no backend required)
 *   - Set VITE_USE_MOCK=false (or omit) to connect to the Spring Boot backend
 */

import type {
  AuthResponse,
  Usuario,
  Cliente,
  Tarefa,
  Sistema,
  AuditLog,
  DashboardSummary,
  PaginatedResponse,
  TaskFilters,
  AuditFilters,
  StatusTarefa,
  Documento,
  Notificacao,
  SearchResultItem,
  SearchResponse,
} from '@/types'
import { mockApi } from './mockData'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const snakeToCamel = (str: string) => str.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''))
const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)

const convertKeysToCamel = (obj: any): any => {
  if (obj === null || typeof obj !== 'object' || obj instanceof File || obj instanceof Blob) return obj
  if (Array.isArray(obj)) return obj.map(convertKeysToCamel)
  return Object.keys(obj).reduce((acc, key) => {
    acc[snakeToCamel(key)] = convertKeysToCamel(obj[key])
    return acc
  }, {} as any)
}

const convertKeysToSnake = (obj: any): any => {
  if (obj === null || typeof obj !== 'object' || obj instanceof File || obj instanceof Blob) return obj
  if (Array.isArray(obj)) return obj.map(convertKeysToSnake)
  return Object.keys(obj).reduce((acc, key) => {
    acc[camelToSnake(key)] = convertKeysToSnake(obj[key])
    return acc
  }, {} as any)
}

// ---------------------------------------------------------------------------
// Fetch wrapper with JWT injection
// ---------------------------------------------------------------------------
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('crm_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  }

  if (options.body && typeof options.body === 'string') {
    try {
      const parsed = JSON.parse(options.body)
      options.body = JSON.stringify(convertKeysToSnake(parsed))
    } catch (e) {
      // Not JSON
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    window.location.href = '/login'
    throw new Error('Sessão expirada')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || `Erro ${res.status}`)
  }

  if (res.status === 204) return {} as T
  const data = await res.json()
  return convertKeysToCamel(data) as T
}

// ---------------------------------------------------------------------------
// Real API functions
// ---------------------------------------------------------------------------
const realApi = {
  auth: {
    loginWithGoogle: (idToken: string) =>
      request<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      }),
    me: () => request<Usuario>('/auth/me'),
  },

  usuarios: {
    getAll: () => request<Usuario[]>('/usuarios'),
    getById: (id: string) => request<Usuario>(`/usuarios/${id}`),
    update: (id: string, data: Partial<Usuario>) =>
      request<Usuario>(`/usuarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  clientes: {
    getAll: (search?: string, page = 0, size = 20) => {
      const params = new URLSearchParams({ page: String(page), size: String(size) })
      if (search) params.set('search', search)
      return request<PaginatedResponse<Cliente>>(`/clientes?${params}`)
    },
    getById: (id: string) => request<Cliente>(`/clientes/${id}`),
    create: (data: Partial<Cliente>) =>
      request<Cliente>('/clientes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Cliente>) =>
      request<Cliente>(`/clientes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    getDocuments: (id: string) => request<Documento[]>(`/clientes/${id}/documentos`),
    notifyPending: (id: string, faltantes?: string[]) => 
      request<{ message: string; portalUrl: string }>(`/clientes/${id}/notificar-pendencias`, { 
        method: 'POST',
        body: faltantes ? JSON.stringify({ faltantes }) : undefined
      }),
    validateCompetencia: (id: string, competencia: string) =>
      request<{ validados: string[], faltantes: string[] }>(`/clientes/${id}/validar-competencia?competencia=${encodeURIComponent(competencia)}`, { method: 'POST' }),
    getPortalLink: (id: string) => 
      request<{ portalUrl: string }>(`/clientes/${id}/portal-link`),
  },

  tarefas: {
    getAll: async (filters?: TaskFilters) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v) params.set(k, v)
        })
      }
      const res = await request<PaginatedResponse<Tarefa>>(`/tarefas?${params}`)
      return res.content
    },
    getById: (id: string) => request<Tarefa>(`/tarefas/${id}`),
    create: (data: Partial<Tarefa>) =>
      request<Tarefa>('/tarefas', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Tarefa>) =>
      request<Tarefa>(`/tarefas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: StatusTarefa) =>
      request<Tarefa>(`/tarefas/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ novoStatus: status }),
      }),
  },

  sistemas: {
    getAll: () => request<Sistema[]>('/sistemas'),
    getByCategoria: (cat: string) => request<Sistema[]>(`/sistemas?categoria=${cat}`),
  },

  acessos: {
    grant: (usuarioId: string, sistemaId: string) =>
      request<void>('/acessos/grant', {
        method: 'POST',
        body: JSON.stringify({ usuarioId, sistemaId }),
      }),
    revoke: (usuarioId: string, sistemaId: string) =>
      request<void>('/acessos/revoke', {
        method: 'POST',
        body: JSON.stringify({ usuarioId, sistemaId }),
      }),
    getByUser: (userId: string) => request<Sistema[]>(`/acessos/usuario/${userId}`),
  },

  auditoria: {
    getAll: (filters?: AuditFilters) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v) params.set(k, v)
        })
      }
      return request<PaginatedResponse<AuditLog>>(`/auditoria?${params}`)
    },
  },

  dashboard: {
    getSummary: () => request<DashboardSummary>('/dashboard/summary'),
  },

  documentos: {
    downloadUrl: (id: string) => `${BASE_URL}/documentos/${id}/download`,
    download: async (id: string, filename: string) => {
      const token = localStorage.getItem('crm_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${BASE_URL}/documentos/${id}/download`, { headers })
      
      if (!res.ok) throw new Error('Erro ao baixar documento')
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    }
  },

  portal: {
    getInfo: (token: string) => request<any>(`/portal/${token}/info`),
    upload: async (token: string, file: File, competencia?: string) => {
      const formData = new FormData()
      formData.append('file', file)
      if (competencia) {
        formData.append('competencia', competencia)
      }
      
      const res = await fetch(`${BASE_URL}/portal/${token}/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Erro no upload')
      return res.json() as Promise<Documento>
    }
  },
  
  notificacoes: {
    getAll: () => request<Notificacao[]>('/notificacoes'),
    marcarComoLida: (id: string) => request<Notificacao>(`/notificacoes/${id}/ler`, { method: 'PUT' }),
  },
  search: {
    query: async (q: string): Promise<SearchResponse> => {
      const { data } = await apiInstance.get('/search', { params: { q } })
      return data
    }
  }
}

// ---------------------------------------------------------------------------
// Export: swap between mock and real based on env flag
// ---------------------------------------------------------------------------
export const api: typeof realApi = USE_MOCK ? (mockApi as any) : realApi
