import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface MonthlyRow {
  employee_id: string
  employee_name: string
  sector_id?: string | null
  expected_hours: number
  worked_hours: number
  justified_hours: number
  unjustified_hours: number
  balance: number
  days_present: number
  days_absent: number
  work_days: number
  attendance_pct: number
}

export interface ChartDay {
  date: string
  day_type: 'normal' | 'weekend' | 'holiday' | 'special'
  expected_h: number
  worked_h: number
  justified_h: number
  unjustified_h: number
}

export interface Alert {
  type: string
  level: 'red' | 'amber' | 'green' | 'purple'
  employee_id?: string
  employee_name?: string
  sector_id?: string
  sector_name?: string
  message: string
}

export function useMonthlyReport(year: number, month: number) {
  return useQuery<MonthlyRow[]>({
    queryKey: ['reports', 'monthly', year, month],
    queryFn: () => api.get(`/api/v1/reports/monthly?year=${year}&month=${month}`),
  })
}

export function useSummaryReport(year: number, month: number, scope: string, ids?: string, sectorId?: string, enabled = true) {
  return useQuery<MonthlyRow[]>({
    queryKey: ['reports', 'summary', year, month, scope, ids, sectorId],
    queryFn: () => {
      const params = new URLSearchParams({ year: String(year), month: String(month), scope })
      if (scope === 'employees' && ids) params.set('ids', ids)
      if (scope === 'sector' && sectorId) params.set('sector_id', sectorId)
      return api.get(`/api/v1/reports/summary?${params}`)
    },
    enabled,
  })
}

export function useChartData(employeeId: string | null, dateFrom: string, dateTo: string) {
  return useQuery<ChartDay[]>({
    queryKey: ['reports', 'chart', employeeId, dateFrom, dateTo],
    queryFn: () => api.get(
      `/api/v1/reports/chart?employee_id=${employeeId}&date_from=${dateFrom}&date_to=${dateTo}`
    ),
    enabled: !!employeeId && !!dateFrom && !!dateTo,
  })
}

export function useDailyReport(employeeId: string | null, year: number, month: number) {
  return useQuery<ChartDay[]>({
    queryKey: ['reports', 'daily', employeeId, year, month],
    queryFn: () => api.get(`/api/v1/reports/daily?employee_id=${employeeId}&year=${year}&month=${month}`),
    enabled: !!employeeId,
  })
}

export interface CalendarDay {
  date: string
  day_type: 'normal' | 'weekend' | 'holiday' | 'special'
  holiday_name?: string | null
  special_label?: string | null
  special_start?: string | null
  special_end?: string | null
  // individual mode
  entry_time?: string | null
  exit_time?: string | null
  worked_h?: number
  expected_h?: number
  is_justified?: boolean
  is_present?: boolean
  // group mode
  present_count?: number
  total_count?: number
  attendance_pct?: number
}

export function useCalendarReport(year: number, month: number, scope: string, ids?: string, sectorId?: string) {
  return useQuery<CalendarDay[]>({
    queryKey: ['reports', 'calendar', year, month, scope, ids, sectorId],
    queryFn: () => {
      const params = new URLSearchParams({ year: String(year), month: String(month), scope })
      if (scope === 'employees' && ids) params.set('ids', ids)
      if (scope === 'sector' && sectorId) params.set('sector_id', sectorId)
      return api.get(`/api/v1/reports/calendar?${params}`)
    },
  })
}

export function useAlerts(year: number, month: number, scope: string, ids?: string, sectorId?: string) {
  return useQuery<Alert[]>({
    queryKey: ['reports', 'alerts', year, month, scope, ids, sectorId],
    queryFn: () => {
      const params = new URLSearchParams({ year: String(year), month: String(month), scope })
      if (scope === 'employees' && ids) params.set('ids', ids)
      if (scope === 'sector' && sectorId) params.set('sector_id', sectorId)
      return api.get(`/api/v1/reports/alerts?${params}`)
    },
  })
}

export interface Totals {
  total_expected_hours:  number
  total_worked_hours:    number
  total_justified_hours: number
  total_balance:        number
  avg_attendance_pct:   number
  employee_count:       number
  pie: {
    present_days:   number
    justified_days: number
    absent_days:    number
  }
}

export function useTotals(year: number, month: number, scope: string, ids?: string, sectorId?: string, enabled = true) {
  return useQuery<Totals>({
    queryKey: ['reports', 'totals', year, month, scope, ids, sectorId],
    queryFn: () => {
      const params = new URLSearchParams({ year: String(year), month: String(month), scope })
      if (scope === 'employees' && ids) params.set('ids', ids)
      if (scope === 'sector' && sectorId) params.set('sector_id', sectorId)
      return api.get(`/api/v1/reports/totals?${params}`)
    },
    enabled,
  })
}

export function buildExportUrl(
  format: 'xlsx' | 'pdf',
  year: number,
  month: number,
  scope: string,
  scopeLabel: string,
  ids?: string,
  sectorId?: string,
): string {
  const params = new URLSearchParams({
    year:        String(year),
    month:       String(month),
    scope,
    scope_label: scopeLabel,
  })
  if (scope === 'employees' && ids) params.set('ids', ids)
  if (scope === 'sector' && sectorId) params.set('sector_id', sectorId)
  return `/api/v1/reports/export/${format}?${params}`
}

// ─── Relatório semanal (intervalo arbitrário de dias) ──────────────────────────

export function useSummaryReportRange(dateFrom: string, dateTo: string, scope: string, ids?: string, sectorId?: string, enabled = true) {
  return useQuery<MonthlyRow[]>({
    queryKey: ['reports', 'summary-range', dateFrom, dateTo, scope, ids, sectorId],
    queryFn: () => {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, scope })
      if (scope === 'employees' && ids) params.set('ids', ids)
      if (scope === 'sector' && sectorId) params.set('sector_id', sectorId)
      return api.get(`/api/v1/reports/summary-range?${params}`)
    },
    enabled: enabled && !!dateFrom && !!dateTo,
  })
}

export function useTotalsRange(dateFrom: string, dateTo: string, scope: string, ids?: string, sectorId?: string, enabled = true) {
  return useQuery<Totals>({
    queryKey: ['reports', 'totals-range', dateFrom, dateTo, scope, ids, sectorId],
    queryFn: () => {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, scope })
      if (scope === 'employees' && ids) params.set('ids', ids)
      if (scope === 'sector' && sectorId) params.set('sector_id', sectorId)
      return api.get(`/api/v1/reports/totals-range?${params}`)
    },
    enabled: enabled && !!dateFrom && !!dateTo,
  })
}

export function buildExportUrlRange(
  format: 'xlsx' | 'pdf',
  dateFrom: string,
  dateTo: string,
  scope: string,
  scopeLabel: string,
  periodLabel: string,
  ids?: string,
  sectorId?: string,
): string {
  const params = new URLSearchParams({
    date_from:    dateFrom,
    date_to:      dateTo,
    scope,
    scope_label:  scopeLabel,
    period_label: periodLabel,
  })
  if (scope === 'employees' && ids) params.set('ids', ids)
  if (scope === 'sector' && sectorId) params.set('sector_id', sectorId)
  return `/api/v1/reports/export/${format}-range?${params}`
}

export function buildCompleteExportUrl(
  format: 'xlsx' | 'pdf',
  year: number,
  month: number,
  scope: string,
  scopeLabel: string,
  ids?: string,
  sectorId?: string,
): string {
  const params = new URLSearchParams({
    year:        String(year),
    month:       String(month),
    scope,
    scope_label: scopeLabel,
  })
  if (scope === 'employees' && ids) params.set('ids', ids)
  if (scope === 'sector' && sectorId) params.set('sector_id', sectorId)
  return `/api/v1/reports/export/complete/${format}?${params}`
}

// ─── Espelho de ponto ─────────────────────────────────────────────────────────

export interface MirrorOccurrence {
  id:                    string
  occurrence_type:       string
  occurrence_type_label: string
  start_time:            string | null
  end_time:              string | null
  justified_hours:       number | null
  reason:                string
  status:                'PENDENTE' | 'APROVADO' | 'REPROVADO'
  status_label:          string
  has_real_punches:      boolean
  attachment_url:        string | null
}

export interface MirrorCorrection {
  original:   string | null
  edited_by:  string
  edited_at:  string | null
  reason:     string | null
}

export interface MirrorRow {
  date:            string
  weekday:         string
  day_type:        'normal' | 'weekend' | 'holiday' | 'special' | 'future' | 'ferias'
  holiday_name:    string | null
  entrada:         string | null
  saida_almoco:    string | null
  retorno_almoco:  string | null
  saida:           string | null
  worked_h:        number
  justified_h:     number
  total_h:         number
  lunch_minutes:   number | null
  expected_h:      number
  status:          'ok' | 'incomplete' | 'absent' | 'justified' | 'weekend' | 'holiday' | 'special' | 'future' | 'ferias'
  has_justification: boolean
  // Chave = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida' — só
  // presente quando aquele horário foi corrigido/lançado manualmente por
  // um admin (ver routers/time_logs.py).
  corrections:     Record<string, MirrorCorrection>
  occurrences:     MirrorOccurrence[]
}

export interface MirrorSummary {
  total_worked_h:      number
  total_expected_h:    number
  total_justified_h:   number
  total_unjustified_h: number
  balance_h:            number
  ok_count:             number
  incomplete_count:     number
  absent_count:         number
  justified_count:      number
  homologado:            boolean
  homologado_by:          string | null
  homologado_em:          string | null
}

export interface MirrorResponse {
  rows:    MirrorRow[]
  summary: MirrorSummary
}

export function useMirror(employeeId: string | null, year: number, month: number) {
  return useQuery<MirrorResponse>({
    queryKey: ['reports', 'mirror', employeeId, year, month],
    queryFn:  () => api.get(`/api/v1/reports/mirror?employee_id=${employeeId}&year=${year}&month=${month}`),
    enabled:  !!employeeId,
  })
}

export function useHomologarMirror() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, year, month }: { employeeId: string; year: number; month: number }) =>
      api.post(`/api/v1/reports/mirror/homologar?employee_id=${employeeId}&year=${year}&month=${month}`, {}),
    onSuccess: (_, { employeeId, year, month }) =>
      qc.invalidateQueries({ queryKey: ['reports', 'mirror', employeeId, year, month] }),
  })
}

export function useReabrirMirror() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, year, month }: { employeeId: string; year: number; month: number }) =>
      api.post(`/api/v1/reports/mirror/reabrir?employee_id=${employeeId}&year=${year}&month=${month}`, {}),
    onSuccess: (_, { employeeId, year, month }) =>
      qc.invalidateQueries({ queryKey: ['reports', 'mirror', employeeId, year, month] }),
  })
}

// ─── Anomalias ────────────────────────────────────────────────────────────────

export interface Anomaly {
  severity:    'critico' | 'suspeito' | 'atencao'
  type:        string
  title:       string
  description: string
  log_id:      string
  log_date:    string
  // Só vem preenchido para fora_do_local/wifi_desconhecido quando o
  // colaborador já anexou uma justificativa à batida pelo kiosk.
  justification_reason?: string | null
  justification_status?: 'PENDENTE' | 'APROVADO' | 'REPROVADO' | null
}

export function useAnomalies(employeeId: string | null, year: number, month: number) {
  return useQuery<Anomaly[]>({
    queryKey: ['reports', 'anomalies', employeeId, year, month],
    queryFn:  () => api.get(`/api/v1/reports/anomalies?employee_id=${employeeId}&year=${year}&month=${month}`),
    enabled:  !!employeeId,
  })
}

// ─── Banco de horas ───────────────────────────────────────────────────────────

export interface TimeBankSummary {
  previous_balance:      number
  expected_hours:        number
  worked_hours:          number
  current_month_balance: number
  accumulated_balance:   number
}

export interface TimeBankRow {
  year:                number
  month:               number
  label:               string
  expected_hours:      number
  worked_hours:        number
  justified_hours:     number
  month_balance:       number
  accumulated_balance: number
  is_current:          boolean
}

export interface TimeBankData {
  summary: TimeBankSummary
  history: TimeBankRow[]
}

export function useTimeBank(employeeId: string | null, year: number, month: number) {
  return useQuery<TimeBankData>({
    queryKey: ['reports', 'time-bank', employeeId, year, month],
    queryFn:  () => api.get(`/api/v1/reports/time-bank?employee_id=${employeeId}&year=${year}&month=${month}`),
    enabled:  !!employeeId,
  })
}

export function buildSubExportUrl(
  tab: 'mirror' | 'anomalies' | 'time-bank',
  format: 'xlsx' | 'pdf',
  employeeId: string,
  year: number,
  month: number,
): string {
  return `/api/v1/reports/${tab}/export/${format}?employee_id=${employeeId}&year=${year}&month=${month}`
}
