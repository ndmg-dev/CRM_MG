import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface CorrectionRequest {
  id: string
  employee_id: string
  employee_name: string
  requested_date: string
  log_type: string
  log_type_label: string
  requested_time: string
  existing_log_id?: string | null
  reason?: string | null
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO'
  reviewed_at?: string | null
  reviewed_note?: string | null
  created_at: string
}

export function useCorrections(status?: string) {
  return useQuery<CorrectionRequest[]>({
    queryKey: ['corrections', status],
    queryFn: () => api.get(`/api/v1/corrections${status ? `?status=${status}` : ''}`),
    refetchInterval: 30_000,
  })
}

export function useApproveCorrection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approved_time, note }: { id: string; approved_time?: string; note?: string }) =>
      api.post(`/api/v1/corrections/${id}/approve`, { approved_time, note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['corrections'] }),
  })
}

export function useRejectCorrection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.post(`/api/v1/corrections/${id}/reject`, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['corrections'] }),
  })
}
