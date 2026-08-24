import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface CctCategory {
  id: string
  company_id: string
  name: string
  union_reference: string | null
  created_at: string
}

export interface CctCategoryCreate {
  name: string
  union_reference?: string | null
}

// Espelha o vocabulário fechado de backend/app/models/cct.py
export type HolidayWorkedRule = 'em_dobro'
export type DsrLossRule = 'falta_ou_atraso' | 'apenas_falta_integral'
export type RoundingRule = 'ao_minuto'
export type FtmarHandling = 'pendencia_manual' | 'falta_parcial_automatica'

export interface CctParameterSet {
  id: string
  category_id: string
  company_id: string
  effective_from: string
  effective_until: string | null
  weekly_hours: number
  work_days_per_week: number
  lunch_break_minutes_gt6h: number
  lunch_break_minutes_4to6h: number
  interval_reduction_allowed: boolean
  interval_reduction_minimum: number | null
  tolerance_per_punch_minutes: number
  tolerance_daily_max_minutes: number
  night_shift_start: string
  night_shift_end: string
  night_shift_percent: number
  night_shift_prorogation: boolean
  overtime_weekday_percent: number
  overtime_sunday_holiday_percent: number
  holiday_worked_rule: HolidayWorkedRule
  time_bank_enabled: boolean
  time_bank_compensation_months: number | null
  dsr_loss_rule: DsrLossRule
  rounding_rule: RoundingRule
  ftmar_handling: FtmarHandling
  created_by: string
  created_at: string
}

export type CctParameterSetCreate = Omit<
  CctParameterSet,
  'id' | 'category_id' | 'company_id' | 'created_by' | 'created_at'
>

export function useCctCategories() {
  return useQuery<CctCategory[]>({
    queryKey: ['cct-categories'],
    queryFn: () => api.get('/api/v1/cct-categories'),
  })
}

export function useCreateCctCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CctCategoryCreate) => api.post<CctCategory>('/api/v1/cct-categories', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cct-categories'] }),
  })
}

export function useCctParameterSets(categoryId: string | null) {
  return useQuery<CctParameterSet[]>({
    queryKey: ['cct-categories', categoryId, 'parameter-sets'],
    queryFn: () => api.get(`/api/v1/cct-categories/${categoryId}/parameter-sets`),
    enabled: !!categoryId,
  })
}

export function useCreateCctParameterSet(categoryId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CctParameterSetCreate) =>
      api.post<CctParameterSet>(`/api/v1/cct-categories/${categoryId}/parameter-sets`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cct-categories', categoryId, 'parameter-sets'] }),
  })
}
