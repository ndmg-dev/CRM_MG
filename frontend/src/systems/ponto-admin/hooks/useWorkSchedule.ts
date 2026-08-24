import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type ScopeType = 'todos' | 'colaborador' | 'grupo' | 'setor'

export interface WorkScheduleSetDay {
  day_of_week: number  // 0=segunda ... 6=domingo
  is_active: boolean
  start_time: string   // "HH:MM:SS" ou "HH:MM"
  work_minutes: number
  lunch_minutes: number
}

export interface WorkScheduleSet {
  id: string
  company_id: string
  scope_type: ScopeType
  scope_id: string | null
  effective_from: string
  weekly_minutes_target: number
  days: WorkScheduleSetDay[]
  created_by: string
  created_at: string
}

export interface WorkScheduleResolveResponse {
  own: WorkScheduleSet | null
  effective: WorkScheduleSet | null
  effective_source: ScopeType | null
}

export function useResolveWorkSchedule(scopeType: ScopeType, scopeId: string | null) {
  return useQuery<WorkScheduleResolveResponse>({
    queryKey: ['work-schedule', 'resolve', scopeType, scopeId],
    queryFn: () => api.get(
      `/api/v1/work-schedule/resolve?scope_type=${scopeType}${scopeId ? `&scope_id=${scopeId}` : ''}`
    ),
    enabled: scopeType === 'todos' || !!scopeId,
  })
}

export interface WorkScheduleSetCreate {
  scope_type: ScopeType
  scope_id: string | null
  weekly_minutes_target: number
  days: WorkScheduleSetDay[]
}

export function useCreateWorkScheduleSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: WorkScheduleSetCreate) => api.post<WorkScheduleSet>('/api/v1/work-schedule', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-schedule'] }),
  })
}
