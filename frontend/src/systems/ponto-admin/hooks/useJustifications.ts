import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface Justification {
  id: string
  reason: string
  date: string
  status: 'PENDENTE' | 'APROVADO' | 'REPROVADO'
  employee_id: string
  time_log_id?: string
  occurrence_type?: string
  start_time?: string | null
  end_time?: string | null
  justified_hours?: number
  affects_chart: boolean
  attachment_url?: string | null
  created_at: string
  batch_id?: string | null
  created_by_name?: string | null
  reviewed_by_name?: string | null
  reviewed_at?: string | null
}

export function useJustifications(params?: { employee_id?: string; status?: string }) {
  const search = new URLSearchParams()
  if (params?.employee_id) search.set('employee_id', params.employee_id)
  if (params?.status) search.set('status', params.status)
  const qs = search.toString()
  return useQuery<Justification[]>({
    queryKey: ['justifications', params],
    queryFn: () => api.get(`/api/v1/justifications${qs ? '?' + qs : ''}`),
    enabled: !!params?.employee_id || !params,
  })
}

export function useCreateJustification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { reason: string; date: string; employee_id: string; time_log_id?: string }) =>
      api.post('/api/v1/justifications', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
  })
}

export function useUpdateJustification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; reason: string; date: string; justified_hours?: number; affects_chart: boolean; time_log_id?: string }) =>
      api.put(`/api/v1/justifications/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
  })
}

export function useDeleteJustification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/justifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
  })
}

export function useApproveJustification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/justifications/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
  })
}

export function useRejectJustification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/justifications/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
  })
}
