import axios from 'axios'
import { supabase } from './supabase'

/**
 * API própria do TaskFlow (NDMG Task Manager, backend Flask do repo
 * TASK_MANANGER), autenticada via JWT do Supabase próprio do sistema
 * (ver lib/supabase.ts) — não usa `/api` relativo, aponta pra origem real
 * do backend, mesmo padrão do Consulta CNPJ/Documentação Contábil (ver
 * consulta-cnpj/api/client.ts).
 */
const API_URL = import.meta.env.VITE_TASKFLOW_API_URL || 'https://taskflow.nucleodigital.cloud'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Injeta o JWT da sessão Supabase do TaskFlow em toda chamada.
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// ─── Tickets ────────────────────────────────────
export const ticketsApi = {
  getAll: (params?: any) => api.get('/tickets', { params }),
  getById: (id: string) => api.get(`/tickets/${id}`),
  create: (data: any) => api.post('/tickets', data),
  update: (id: string, data: any) => api.put(`/tickets/${id}`, data),
  move: (id: string, data: any) => api.patch(`/tickets/${id}/move`, data),
  delete: (id: string) => api.delete(`/tickets/${id}`),
  reorder: (data: any) => api.post('/tickets/reorder', data),
}

// ─── Users ──────────────────────────────────────
export const usersApi = {
  getAll: (params?: any) => api.get('/users', { params }),
  getMe: () => api.get('/users/me'),
}

// ─── Departments (Setores) ──────────────────────
export const departmentsApi = {
  getMine: () => api.get('/departments'),
  getAll: () => api.get('/departments/all'),
  create: (data: any) => api.post('/departments', data),
  update: (id: string, data: any) => api.put(`/departments/${id}`, data),
  delete: (id: string) => api.delete(`/departments/${id}`),
  addMember: (id: string, userId: string, papel = 'member') =>
    api.post(`/departments/${id}/members`, { user_id: userId, papel }),
  removeMember: (id: string, userId: string) => api.delete(`/departments/${id}/members/${userId}`),
}

// ─── Notificações (avisos de prazo) ─────────────
export const notificationsApi = {
  getStatus: () => api.get('/notifications/status'),
  run: (dryRun = false) => api.post('/notifications/run', { dry_run: dryRun }),
}

// ─── Metrics ────────────────────────────────────
export const metricsApi = {
  getThroughput: (params?: any) => api.get('/metrics/throughput', { params }),
  getCycleTime: (params?: any) => api.get('/metrics/cycle-time', { params }),
  getLeadTime: (params?: any) => api.get('/metrics/lead-time', { params }),
  getBottlenecks: (params?: any) => api.get('/metrics/bottlenecks', { params }),
}

// ─── AI ─────────────────────────────────────────
export const aiApi = {
  getWeeklyReport: () => api.post('/ai/weekly-report'),
  getCodeReview: (ticketId: string) => api.post('/github/code-review', { ticket_id: ticketId }),
}

// ─── GitHub ─────────────────────────────────────
export const githubApi = {
  createPR: (ticketId: string, includeAiReview = true) =>
    api.post('/github/create-pr', { ticket_id: ticketId, include_ai_review: includeAiReview }),
  getOpenPRs: () => api.get('/github/open-prs'),
  getBranchStatus: (ticketId: string) => api.get(`/github/branch-status/${ticketId}`),
}

// ─── Admin ───────────────────────────────────────
export const adminApi = {
  getUsers: () => api.get('/admin/users'),
  updateUserRole: (id: string, role: string) => api.patch(`/admin/users/${id}/role`, { role }),
}

// ─── Attachments ─────────────────────────────────
export const attachmentsApi = {
  upload: (ticketId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/tickets/${ticketId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (ticketId: string, attachmentId: string) => api.delete(`/tickets/${ticketId}/attachments/${attachmentId}`),
}

// ─── Checklists ──────────────────────────────────
export const checklistsApi = {
  add: (ticketId: string, text: string) => api.post(`/tickets/${ticketId}/checklists`, { text }),
  update: (itemId: string, data: any) => api.put(`/tickets/checklists/${itemId}`, data),
  delete: (itemId: string) => api.delete(`/tickets/checklists/${itemId}`),
}

export default api
