import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface TimeLog {
  id: string
  type: 'ENTRADA' | 'SAIDA_ALMOCO' | 'RETORNO_ALMOCO' | 'SAIDA' | 'SAIDA_INTERVALO' | 'RETORNO_INTERVALO'
  status: 'VERIFICADO' | 'JUSTIFICADO' | 'PENDENTE' | 'WIFI_DESCONHECIDO' | 'FORA_DO_LOCAL'
  source: string
  notes?: string
  created_at: string
  /** Preenchido só quando o horário foi corrigido (não em criações manuais puras) — ver comentário no model do backend. */
  original_created_at?: string
  edited_by_name?: string
  edited_at?: string
  employee_id: string
  company_id: string
  latitude?: number
  longitude?: number
  address?: string
  wifi_bssid?: string
  validation_method?: string
  validation_detail?: string
  face_confidence?: number
  face_match_quality?: string
  device_ip?: string
  device_user_agent?: string
  device_timezone?: string
  device_timestamp?: string
  server_client_time_diff_seconds?: number
  connection_type?: string
  kiosk_id?: string
}

export interface TimeLogUpdate {
  type: TimeLog['type']
  created_at: string
  status?: TimeLog['status']
  notes?: string
}

export function useUpdateTimeLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: TimeLogUpdate & { id: string }) =>
      api.put(`/api/v1/time-logs/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-logs'] }),
  })
}

export function useDeleteTimeLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/time-logs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-logs'] }),
  })
}

export interface ManualTimeLogCreate {
  employee_id: string
  type: TimeLog['type']
  created_at: string
  notes?: string
}

export function useCreateManualTimeLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ManualTimeLogCreate) => api.post('/api/v1/time-logs/manual', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-logs'] }),
  })
}

export function useTimeLogs(params?: { employee_id?: string; sector_id?: string; date_from?: string; date_to?: string; limit?: number }) {
  const search = new URLSearchParams()
  if (params?.employee_id) search.set('employee_id', params.employee_id)
  if (params?.sector_id) search.set('sector_id', params.sector_id)
  if (params?.date_from) search.set('date_from', params.date_from)
  if (params?.date_to) search.set('date_to', params.date_to)
  if (params?.limit) search.set('limit', String(params.limit))
  const qs = search.toString()
  return useQuery<TimeLog[]>({
    queryKey: ['time-logs', params],
    queryFn: () => api.get(`/api/v1/time-logs${qs ? '?' + qs : ''}`),
  })
}

export interface TodaySummary {
  present_today: number
  absent_today: number
  /** Ativos sem ENTRADA hoje e sem justificativa aprovada cobrindo o dia. */
  absent_employee_ids: string[]
  punches_today: number
  pending_review: number
  in_occurrence_now: number
  pending_occurrences_today: number
  logs: Array<{
    id: string
    employee_id: string
    type: TimeLog['type']
    status: TimeLog['status']
    created_at: string
    face_confidence?: number
  }>
}

export function useTodaySummary() {
  return useQuery<TodaySummary>({
    queryKey: ['analytics', 'today'],
    queryFn: () => api.get('/api/v1/analytics/today'),
    refetchInterval: 60_000,
  })
}
