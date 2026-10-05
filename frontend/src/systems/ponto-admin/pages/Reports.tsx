import { useState, useMemo } from 'react'
import { useSummaryReport, useDailyReport, useAlerts, useCalendarReport, useTotals,
         useMirror, useHomologarMirror, useReabrirMirror, useAnomalies, useTimeBank,
         useSummaryReportRange, useTotalsRange, type MirrorResponse } from '../hooks/useReports'
import MirrorTab    from '../components/MirrorTab'
import AnomaliesTab from '../components/AnomaliesTab'
import TimeBankTab  from '../components/TimeBankTab'
import LogDetailModal from '../components/LogDetailModal'
import ReportFilters from '../components/reports/ReportFilters'
import ReportsExportModal from '../components/reports/ReportsExportModal'
import MonthlyReportTab from '../components/reports/MonthlyReportTab'
import { C } from '../components/reports/colors'
import { useTimeLogs, useUpdateTimeLog, useCreateManualTimeLog, type TimeLog } from '../hooks/useTimeLogs'
import { useJustifications, useCreateJustification } from '../hooks/useJustifications'
import { useEmployees } from '../hooks/useEmployees'
import { useSectors } from '../hooks/useSectors'
import { toInputDate, toInputTime, isoWeekBounds, toInputDateLocal, localDayRangeToUtcIso, fmtDayMonth } from '../utils/date'
import { TYPE_LABELS, STATUS_LABELS } from '../utils/labels'
import { Modal } from '../components/Modal'
import { useAuth } from '../hooks/useAuth'
import '../styles/reports.css'

function fmtH(h: number, signed = false) {
  const total = Math.round(Math.abs(h) * 60)
  return `${signed ? h > 0 ? '+' : h < 0 ? '−' : '' : ''}${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`
}

function combineWeeklyMirror(first: MirrorResponse, second: MirrorResponse | undefined, from: string, to: string): MirrorResponse {
  const rows = [...first.rows, ...(second?.rows ?? [])]
    .filter(row => row.date >= from && row.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
  const total = (field: 'worked_h' | 'expected_h' | 'justified_h') =>
    Math.round(rows.reduce((sum, row) => sum + row[field], 0) * 100) / 100
  const worked = total('worked_h')
  const expected = total('expected_h')
  const justified = total('justified_h')
  return {
    rows,
    summary: {
      total_worked_h: worked,
      total_expected_h: expected,
      total_justified_h: justified,
      total_unjustified_h: rows.filter(row => row.status === 'absent').reduce((sum, row) => sum + row.expected_h, 0),
      balance_h: Math.round((worked + justified - expected) * 100) / 100,
      ok_count: rows.filter(row => row.status === 'ok').length,
      incomplete_count: rows.filter(row => row.status === 'incomplete').length,
      absent_count: rows.filter(row => row.status === 'absent').length,
      justified_count: rows.filter(row => row.status === 'justified').length,
      homologado: false,
      homologado_by: null,
      homologado_em: null,
    },
  }
}

// ─── Modal editar ponto ───────────────────────────────────────────────────────

function EditLogModal({ log, employeeId, employees, initialDate, initialType, onClose }: {
  log: TimeLog | null; employeeId: string; employees: { id: string; name: string }[]; initialDate?: string; initialType?: TimeLog['type']; onClose: () => void
}) {
  const isNew = !log
  const createMutation = useCreateManualTimeLog()
  const updateMutation = useUpdateTimeLog()
  const [form, setForm] = useState({
    employee_id: employeeId,
    date: log ? toInputDate(log.created_at) : initialDate ?? new Date().toLocaleDateString('en-CA'),
    time: log ? toInputTime(log.created_at) : '08:00',
    type:   (log?.type   ?? initialType ?? 'ENTRADA')   as TimeLog['type'],
    status: (log?.status ?? 'VERIFICADO') as TimeLog['status'],
    reason: '',
    observation: '',
  })
  const [err, setErr] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!form.reason || form.reason === 'Outro' && !form.observation.trim()) {
      setErr('Informe a justificativa e, se escolher Outro, descreva o motivo.')
      return
    }
    const created_at = new Date(`${form.date}T${form.time}:00`).toISOString()
    try {
      if (isNew) {
        await createMutation.mutateAsync({ employee_id: form.employee_id, type: form.type, created_at, reason: form.reason, observation: form.observation.trim() || undefined })
      } else {
        await updateMutation.mutateAsync({ id: log!.id, type: form.type, created_at, status: form.status, reason: form.reason, observation: form.observation.trim() || undefined })
      }
      onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <Modal open={true} onClose={onClose} title={isNew ? 'Adicionar ponto' : 'Editar ponto'} maxWidth={400}>
      <form onSubmit={handleSave}>
        {isNew && (
          <div className="form-group">
            <label className="form-label">Funcionário</label>
            <select className="form-input" value={form.employee_id}
              onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Data</label>
            <input className="form-input" type="date" value={form.date} required
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Horário</label>
            <input className="form-input" type="time" value={form.time} required
              onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-input" value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as TimeLog['type'] }))}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {!isNew && (
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as TimeLog['status'] }))}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Justificativa</label>
          <select className="form-input" value={form.reason} required onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
            <option value="">Selecione o motivo</option>
            {['Esquecimento de marcação', 'Falha no relógio/app', 'Trabalho externo', 'Atestado/consulta', 'Erro de marcação', 'Outro'].map(reason => <option key={reason} value={reason}>{reason}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Observação</label>
          <input className="form-input" value={form.observation} required={form.reason === 'Outro'} placeholder={form.reason === 'Outro' ? 'Descreva o motivo' : 'Opcional'}
            onChange={e => setForm(f => ({ ...f, observation: e.target.value }))} />
        </div>
        {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary"
            disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal justificar ─────────────────────────────────────────────────────────

function JustifyModal({ log, employeeId, initialDate, onClose }: { log: TimeLog | null; employeeId: string; initialDate?: string; onClose: () => void }) {
  const createMutation = useCreateJustification()
  const [form, setForm] = useState({
    reason: '',
    date: log ? toInputDate(log.created_at) : initialDate ?? new Date().toLocaleDateString('en-CA'),
    employee_id: employeeId,
    time_log_id: log?.id,
  })
  const [err, setErr] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const reason = form.reason.trim()
    if (!reason) { setErr('O motivo não pode ser vazio.'); return }
    try {
      await createMutation.mutateAsync({ reason, date: new Date(`${form.date}T12:00:00`).toISOString(), employee_id: form.employee_id, time_log_id: form.time_log_id })
      onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <Modal open={true} onClose={onClose} title="Justificar ausência" maxWidth={380}>
      <form onSubmit={handleSave}>
        <p className="report-page-subtitle">As horas justificadas entram nos totais após a aprovação.</p>
        <div className="form-group">
          <label className="form-label">Data</label>
          <input className="form-input" type="date" value={form.date} required
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Motivo</label>
          <textarea className="form-input" value={form.reason} required rows={3}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
        </div>
        {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Reports() {
  const now = new Date()
  const [period, setPeriod] = useState<'month' | 'week'>('month')
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [weekAnchor, setWeekAnchor] = useState(now)
  const [scope, setScope] = useState<'employee' | 'sector' | 'team'>('employee')
  const [selectedEmployeeChoice, setSelectedEmployee] = useState<string>('')
  const [selectedSector,   setSelectedSector]   = useState<string>('')
  const [showCharts,   setShowCharts]   = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showAlerts,   setShowAlerts]   = useState(false)
  const [expandedLogs, setExpandedLogs] = useState(false)
  const [editLog,    setEditLog]    = useState<TimeLog | null | 'new'>()
  const [editDate,   setEditDate]   = useState<string>()
  const [editType,   setEditType]   = useState<TimeLog['type']>()
  const [justifyLog, setJustifyLog] = useState<TimeLog | null>()
  const [detailLog,  setDetailLog]  = useState<TimeLog | null>(null)
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [innerTab, setInnerTab] = useState<'registros' | 'espelho' | 'anomalias' | 'banco'>('espelho')
  const [showExport, setShowExport] = useState(false)
  const [justifyDate, setJustifyDate] = useState<string>()
  const [mirrorFilterRequest, setMirrorFilterRequest] = useState(0)
  const [mirrorFocus, setMirrorFocus] = useState<string | null>(null)
  const [mirrorFocusRequest, setMirrorFocusRequest] = useState(0)
  const { can } = useAuth()

  const { data: employees = [] } = useEmployees()
  const { data: sectors   = [] } = useSectors()

  const sectorMap = useMemo(
    () => Object.fromEntries(sectors.map(s => [s.id, s])),
    [sectors]
  )

  const sortedEmployees = useMemo(
    () => [...employees].filter(e => e.is_active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [employees]
  )

  const employeeNameMap = useMemo(
    () => Object.fromEntries(employees.map(e => [e.id, e.name])),
    [employees]
  )

  const selectedEmployee = sortedEmployees.some(e => e.id === selectedEmployeeChoice)
    ? selectedEmployeeChoice : (sortedEmployees[0]?.id ?? '')
  const isEmployeeScope = scope === 'employee'
  const subEmpId = isEmployeeScope ? selectedEmployee || null : null
  const isWeek = period === 'week'
  const { start: weekStart, end: weekEnd } = useMemo(() => isoWeekBounds(weekAnchor), [weekAnchor])
  const weekFrom = toInputDateLocal(weekStart)
  const weekTo = toInputDateLocal(weekEnd)
  const weekLabel = `${fmtDayMonth(weekStart)} – ${fmtDayMonth(weekEnd)}/${weekEnd.getFullYear()}`
  const weekCrossesMonth = weekStart.getFullYear() !== weekEnd.getFullYear() || weekStart.getMonth() !== weekEnd.getMonth()

  const { data: monthMirror, error: monthMirrorError } = useMirror(subEmpId, year, month, !isWeek)
  const { data: weekFirstMirror, error: weekFirstError } = useMirror(subEmpId, weekStart.getFullYear(), weekStart.getMonth() + 1, isWeek)
  const { data: weekSecondMirror, error: weekSecondError } = useMirror(subEmpId, weekEnd.getFullYear(), weekEnd.getMonth() + 1, isWeek && weekCrossesMonth)
  const mirrorData = useMemo(() => {
    if (!isWeek) return monthMirror
    if (!weekFirstMirror || (weekCrossesMonth && !weekSecondMirror)) return undefined
    return combineWeeklyMirror(weekFirstMirror, weekCrossesMonth ? weekSecondMirror : undefined, weekFrom, weekTo)
  }, [isWeek, monthMirror, weekFirstMirror, weekSecondMirror, weekCrossesMonth, weekFrom, weekTo])
  const mirrorError = isWeek ? (weekFirstError ?? weekSecondError) : monthMirrorError
  const homologarMirror = useHomologarMirror()
  const reabrirMirror = useReabrirMirror()
  const lockedMonths = new Set<string>()
  if (isWeek && weekFirstMirror?.summary.homologado) lockedMonths.add(weekFrom.slice(0, 7))
  if (isWeek && weekCrossesMonth && weekSecondMirror?.summary.homologado) lockedMonths.add(weekTo.slice(0, 7))

  const { data: anomalies = [] } = useAnomalies(subEmpId, year, month)
  const { data: timeBankData } = useTimeBank(subEmpId, year, month)

  const apiScope    = scope === 'employee' ? 'employees' : scope
  const idsParam    = scope === 'employee' ? selectedEmployee : undefined
  const sectorParam = scope === 'sector'   ? selectedSector  : undefined

  const { data: alerts = [] } = useAlerts(year, month, apiScope, idsParam, sectorParam)

  // Os dois períodos usam hooks separados (endpoints diferentes no backend —
  // ver /reports/summary vs /reports/summary-range); `enabled` evita buscar
  // os dois ao mesmo tempo ao alternar Mensal/Semanal.
  const { data: summaryMonth = [] } = useSummaryReport(year, month, apiScope, idsParam, sectorParam, !isWeek)
  const { data: totalsMonth, isFetching: totalsMonthFetching } = useTotals(year, month, apiScope, idsParam, sectorParam, !isWeek)
  const { data: summaryWeek = [] } = useSummaryReportRange(weekFrom, weekTo, apiScope, idsParam, sectorParam, isWeek)
  const { data: totalsWeek, isFetching: totalsWeekFetching } = useTotalsRange(weekFrom, weekTo, apiScope, idsParam, sectorParam, isWeek)

  const summary      = isWeek ? summaryWeek : summaryMonth
  const serverTotals = isWeek ? totalsWeek  : totalsMonth
  const totalsRefreshing = isWeek ? totalsWeekFetching : totalsMonthFetching

  const dailyEmpId = scope === 'employee' ? selectedEmployee : (summary[0]?.employee_id ?? null)
  const { data: dailyData = [] } = useDailyReport(dailyEmpId, year, month)

  const firstDay = isWeek ? weekFrom : `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay  = isWeek ? weekTo   : new Date(year, month, 0).toLocaleDateString('en-CA')

  const { data: logs = [], isLoading: logsLoading, error: logsError } = useTimeLogs({
    date_from:   localDayRangeToUtcIso(firstDay).from,
    date_to:     localDayRangeToUtcIso(lastDay).to,
    employee_id: scope === 'employee' ? selectedEmployee : undefined,
    sector_id:   scope === 'sector'   ? selectedSector   : undefined,
    limit:       500,
  })

  const { data: justifications = [] } = useJustifications(
    scope === 'employee' && selectedEmployee ? { employee_id: selectedEmployee } : undefined
  )

  const { data: calendarDays = [] } = useCalendarReport(calYear, calMonth, apiScope, idsParam, sectorParam)

  // Aggregated totals come from the server — no business logic on the frontend
  const totals = {
    exp:    serverTotals?.total_expected_hours  ?? 0,
    wrk:    serverTotals?.total_worked_hours    ?? 0,
    just:   serverTotals?.total_justified_hours ?? 0,
    avgPct: serverTotals?.avg_attendance_pct    ?? 0,
  }

  const doughnutData = useMemo(() => {
    if (!serverTotals) return []
    const { present_days, justified_days, absent_days } = serverTotals.pie
    return [
      { name: 'Presente',    value: present_days,   color: C.worked },
      { name: 'Justificado', value: justified_days,  color: C.justified },
      { name: 'Ausente',     value: absent_days,     color: C.unjustified },
    ].filter(d => d.value > 0)
  }, [serverTotals])

  const filteredAlerts = useMemo(() => {
    if (scope === 'employee' && selectedEmployee)
      return alerts.filter(a => !a.employee_id || a.employee_id === selectedEmployee)
    if (scope === 'sector' && selectedSector)
      return alerts.filter(a => !a.sector_id || a.sector_id === selectedSector)
    return alerts
  }, [alerts, scope, selectedEmployee, selectedSector])

  const selectedEmpObj = sortedEmployees.find(e => e.id === selectedEmployee)

  const sectionTitle = useMemo(() => {
    if (scope === 'employee') return selectedEmpObj?.name ?? '—'
    if (scope === 'sector') {
      const sec = sectors.find(s => s.id === selectedSector)
      return sec ? `Setor ${sec.name}` : 'Setor'
    }
    return 'Equipe toda'
  }, [scope, selectedEmpObj, sectors, selectedSector])

  function closePanels() {
    setShowCharts(false); setShowCalendar(false); setShowAlerts(false)
    setExpandedLogs(false)
  }

  function changeScope(s: typeof scope) {
    setScope(s); closePanels()
    setMirrorFocus(null)
    setMirrorFilterRequest(0)
    setInnerTab(s === 'employee' ? 'espelho' : 'registros')
  }

  function changePeriod(p: typeof period) {
    setPeriod(p); closePanels()
    setMirrorFilterRequest(0)
    setMirrorFocus(null)
    if (p === 'week' && (innerTab === 'anomalias' || innerTab === 'banco')) setInnerTab('espelho')
  }

  function onPickEmployee(id: string) {
    setSelectedEmployee(id); closePanels()
    setMirrorFilterRequest(0)
    setMirrorFocus(null)
  }

  function stepEmployee(direction: number) {
    const index = sortedEmployees.findIndex(employee => employee.id === selectedEmployee)
    if (index < 0 || sortedEmployees.length === 0) return
    onPickEmployee(sortedEmployees[(index + direction + sortedEmployees.length) % sortedEmployees.length].id)
  }

  function stepMonth(direction: number) {
    const next = new Date(year, month - 1 + direction, 1)
    setYear(next.getFullYear()); setMonth(next.getMonth() + 1)
    setMirrorFilterRequest(0)
    setMirrorFocus(null)
  }

  function toggleHomologar() {
    if (!selectedEmployee || !monthMirror) return
    if (monthMirror.summary.homologado) {
      if (window.confirm('Reabrir este mês para correções?')) reabrirMirror.mutate({ employeeId: selectedEmployee, year, month })
    } else if (window.confirm('Homologar este mês? Não será mais possível corrigir pontos até reabrir.')) {
      homologarMirror.mutate({ employeeId: selectedEmployee, year, month })
    }
  }

  function prevCalMonth() {
    if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function nextCalMonth() {
    if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page animate-in">

      <div className="report-v2-top">
        <ReportFilters
          scope={scope}
          onChangeScope={changeScope}
          employees={sortedEmployees}
          sectorMap={sectorMap}
          sectors={sectors}
          selectedEmployee={selectedEmployee}
          onPickEmployee={onPickEmployee}
          onStepEmployee={stepEmployee}
          selectedSector={selectedSector}
          onSelectSector={setSelectedSector}
        />
        <div className="report-v2-top-actions">
          <div className="report-v2-period" aria-label="Período da consulta">
            <button type="button" aria-label="Período anterior" onClick={() => period === 'month' ? stepMonth(-1) : setWeekAnchor(d => { const next = new Date(d); next.setDate(next.getDate() - 7); return next })}>‹</button>
            <button type="button" className="report-v2-period-label" title="Alternar entre visão mensal e semanal" aria-label={`Visão ${period === 'month' ? 'mensal' : 'semanal'}. Alternar período`} onClick={() => changePeriod(period === 'month' ? 'week' : 'month')}>{period === 'month' ? new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : weekLabel}</button>
            <button type="button" aria-label="Próximo período" onClick={() => period === 'month' ? stepMonth(1) : setWeekAnchor(d => { const next = new Date(d); next.setDate(next.getDate() + 7); return next })}>›</button>
          </div>
          <button type="button" className="report-v2-export" onClick={() => setShowExport(true)}>Exportar ▾</button>
        </div>
      </div>

      {/* Card de registros */}
      <div className="card report-main-card" style={{ marginBottom: 20 }}>
        {totalsRefreshing && <div className="report-refresh-status" role="status">Atualizando dados do período...</div>}
        <div className="report-summary-strip" aria-label="Resumo do período">
          <div className="report-kpi report-kpi-balance"><span>Saldo {isWeek ? 'da semana' : 'do mês'}</span><strong className={(serverTotals?.total_balance ?? 0) >= 0 ? 'positive' : 'negative'}>{fmtH(serverTotals?.total_balance ?? 0, true)}</strong></div>
          <div className="report-kpi"><span>Trabalhadas</span><strong>{fmtH(totals.wrk)}</strong><small>de {fmtH(totals.exp)} esperadas</small></div>
          <div className="report-kpi"><span>Justificadas</span><strong>{fmtH(totals.just)}</strong></div>
          <div className="report-kpi"><span>Presença</span><strong>{Math.round(totals.avgPct)}%</strong>{isEmployeeScope && mirrorData && <small>{mirrorData.rows.filter(row => row.expected_h > 0).length} dias úteis</small>}</div>
          <button type="button" className="report-kpi report-v2-pending-kpi" disabled={!isEmployeeScope} onClick={() => { setMirrorFocus(null); setInnerTab('espelho'); setMirrorFilterRequest(value => value + 1) }}><span>Pendências</span><strong>{isEmployeeScope ? (mirrorData?.summary.incomplete_count ?? 0) + (mirrorData?.summary.absent_count ?? 0) : '—'}</strong><small>Revisar →</small></button>
        </div>
        {isEmployeeScope && (
          <div className="report-tab-bar"><div className="report-tabs" role="tablist" aria-label="Visões do ponto">
            {(isWeek ? [
              ['espelho', 'Espelho de ponto', null],
              ['registros', 'Registros', null],
            ] : [
              ['espelho', 'Espelho de ponto', null],
              ['registros', 'Registros', null],
              ['banco', 'Banco de horas', null],
            ]).map(([key, label, badge]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={innerTab === key || innerTab === 'anomalias' && key === 'registros'}
                onClick={() => setInnerTab(key as typeof innerTab)}
                className={innerTab === key || innerTab === 'anomalias' && key === 'registros' ? 'active' : ''}
              >
                {label}
                {typeof badge === 'number' && badge > 0 && (
                  <span style={{
                    marginLeft: 6, background: 'rgba(226,75,74,0.2)', color: 'var(--mg-red)',
                    borderRadius: 10, padding: '1px 6px', fontSize: 10,
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            ))}</div>
            {innerTab === 'espelho' && !isWeek && monthMirror && <div className="report-month-action"><span className={monthMirror.summary.homologado ? 'closed' : ''}><i /> Mês {monthMirror.summary.homologado ? 'homologado' : 'aberto'}</span>{can('corrections') && <button type="button" onClick={toggleHomologar} disabled={homologarMirror.isPending || reabrirMirror.isPending}>{monthMirror.summary.homologado ? 'Reabrir mês' : 'Homologar mês'}</button>}</div>}
          </div>
        )}

        {(homologarMirror.error || reabrirMirror.error) && <p className="report-export-error" role="alert">{homologarMirror.error?.message || reabrirMirror.error?.message}</p>}

        {/* Cabeçalho — título e ações condicionais por aba */}
        {innerTab !== 'espelho' && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
            {innerTab === 'registros'  && `Registros — ${sectionTitle}`}
            {innerTab === 'anomalias'  && `Anomalias — ${sectionTitle}`}
            {innerTab === 'banco'      && `Banco de horas — ${sectionTitle}`}
          </div>
          {/* Ações: somente na aba Registros */}
          {innerTab === 'registros' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {anomalies.length > 0 && !isWeek && <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setInnerTab('anomalias')}>Anomalias ({anomalies.length})</button>}
              {/* Gráficos/Calendário/Alertas ainda são só mensais */}
              {!isWeek && (
                <>
                  <button onClick={() => setShowCharts(v => !v)}
                    className={showCharts ? 'btn-primary' : 'btn-ghost'}
                    style={{ fontSize: 12, padding: '5px 12px' }}>
                    ▦ Ver gráficos
                  </button>
                  <button onClick={() => setShowCalendar(v => !v)}
                    className={showCalendar ? 'btn-primary' : 'btn-ghost'}
                    style={{ fontSize: 12, padding: '5px 12px' }}>
                    ◫ Calendário
                  </button>
                  <button onClick={() => setShowAlerts(v => !v)}
                    className={showAlerts ? 'btn-primary' : 'btn-ghost'}
                    style={{ fontSize: 12, padding: '5px 12px' }}>
                    ◉ Alertas{filteredAlerts.length > 0 ? ` (${filteredAlerts.length})` : ''}
                  </button>
                </>
              )}
              <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => { setEditDate(undefined); setEditType(undefined); setEditLog('new') }}>
                + Adicionar ponto
              </button>
            </div>
          )}
        </div>}

        {/* ── Aba Registros ──────────────────────────────────────────────── */}
        {innerTab === 'registros' && (
          <MonthlyReportTab
            showCharts={showCharts}
            showCalendar={showCalendar}
            showAlerts={showAlerts}
            dailyData={dailyData}
            doughnutData={doughnutData}
            calendarDays={calendarDays}
            calYear={calYear}
            calMonth={calMonth}
            onPrevCalMonth={prevCalMonth}
            onNextCalMonth={nextCalMonth}
            filteredAlerts={filteredAlerts}
            logs={logs}
            expandedLogs={expandedLogs}
            onExpandLogs={() => setExpandedLogs(true)}
            justifications={justifications}
            onOpenDetail={log => {
              if (!isEmployeeScope) { setDetailLog(log); return }
              setMirrorFocus(toInputDate(log.created_at))
              setMirrorFocusRequest(value => value + 1)
              setInnerTab('espelho')
            }}
            onEditLog={setEditLog}
            onJustifyLog={log => { setJustifyDate(undefined); setJustifyLog(log) }}
            employeeNames={scope !== 'employee' ? employeeNameMap : undefined}
            employeeName={scope === 'employee' ? sectionTitle : undefined}
          />
        )}

        {/* ── Aba Espelho de ponto ───────────────────────────────────────── */}
        {innerTab === 'espelho' && (
          <MirrorTab
            key={`${selectedEmployee}:${period}:${isWeek ? weekFrom : `${year}-${month}`}:${mirrorFilterRequest}:${mirrorFocusRequest}`}
            data={mirrorData}
            error={mirrorError}
            logsLoading={logsLoading}
            logsError={logsError}
            employeeId={selectedEmployee}
            canManage={can('corrections')}
            canJustify={can('justifications')}
            lockedMonths={lockedMonths}
            logs={logs.filter(log => log.employee_id === selectedEmployee)}
            onJustifyDay={date => { setJustifyLog(null); setJustifyDate(date) }}
            filterRequest={mirrorFilterRequest}
            focusDate={mirrorFocus}
          />
        )}

        {/* ── Aba Anomalias ──────────────────────────────────────────────── */}
        {innerTab === 'anomalias' && (
          <AnomaliesTab
            anomalies={anomalies}
            onOpenLog={logId => {
              const log = logs.find(l => l.id === logId)
              if (log) setDetailLog(log)
            }}
          />
        )}

        {/* ── Aba Banco de horas ─────────────────────────────────────────── */}
        {innerTab === 'banco' && (
          <TimeBankTab
            data={timeBankData}
          />
        )}

      </div>

      {showExport && <ReportsExportModal
        onClose={() => setShowExport(false)}
        scope={apiScope}
        scopeLabel={sectionTitle}
        employeeId={selectedEmployee}
        ids={idsParam}
        sectorId={sectorParam}
        initialPeriod={period}
        initialYear={year}
        initialMonth={month}
        initialWeekDate={toInputDateLocal(weekAnchor)}
      />}

      {/* Modais */}
      {detailLog && <LogDetailModal log={detailLog} onClose={() => setDetailLog(null)} />}
      {editLog && (
        <EditLogModal
          log={editLog === 'new' ? null : editLog}
          employeeId={selectedEmployee || sortedEmployees[0]?.id || ''}
          employees={sortedEmployees}
          initialDate={editDate}
          initialType={editType}
          onClose={() => { setEditLog(undefined); setEditDate(undefined); setEditType(undefined) }}
        />
      )}
      {(justifyLog || justifyDate) && (
        <JustifyModal
          log={justifyLog ?? null}
          employeeId={selectedEmployee || ''}
          initialDate={justifyDate}
          onClose={() => { setJustifyLog(undefined); setJustifyDate(undefined) }}
        />
      )}
    </div>
  )
}
