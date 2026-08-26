import { useState, useMemo, useEffect, useRef } from 'react'
import { useSummaryReport, useDailyReport, useAlerts, useCalendarReport, useTotals, buildExportUrl,
         buildCompleteExportUrl, useMirror, useAnomalies, useTimeBank, buildSubExportUrl,
         useSummaryReportRange, useTotalsRange, buildExportUrlRange } from '../hooks/useReports'
import MirrorTab    from '../components/MirrorTab'
import AnomaliesTab from '../components/AnomaliesTab'
import TimeBankTab  from '../components/TimeBankTab'
import LogDetailModal from '../components/LogDetailModal'
import ReportFilters from '../components/reports/ReportFilters'
import MonthlyReportTab from '../components/reports/MonthlyReportTab'
import { C } from '../components/reports/colors'
import { useTimeLogs, useDeleteTimeLog, useUpdateTimeLog, useCreateManualTimeLog, type TimeLog } from '../hooks/useTimeLogs'
import { useJustifications, useCreateJustification } from '../hooks/useJustifications'
import { useEmployees } from '../hooks/useEmployees'
import { useSectors } from '../hooks/useSectors'
import { toInputDate, toInputTime } from '../utils/date'
import { TYPE_LABELS, STATUS_LABELS } from '../utils/labels'
import { downloadBlob } from '../lib/api'
import { Modal } from '../components/Modal'
import KpiCard, { type Tone } from '../components/dashboard/MetricCard'
import { useAuth } from '../hooks/useAuth'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtH(h: number) { return `${h.toFixed(1)}h` }

// ─── Semana (segunda a domingo) ────────────────────────────────────────────────

/** Segunda e domingo da semana ISO que contém `anchor`. */
function isoWeekBounds(anchor: Date): { start: Date; end: Date } {
  const day = anchor.getDay() // 0=domingo..6=sábado
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(anchor)
  start.setDate(anchor.getDate() + diffToMonday)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}
function toInputDateLocal(d: Date): string {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD, timezone do browser
}
function fmtDayMonth(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ─── Dropdown de exportação ───────────────────────────────────────────────────

function ExportDropdown({ label, variant, items }: {
  label: string
  variant: 'btn-ghost' | 'btn-primary'
  items: { label: string; onClick: () => void }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={variant} style={{ fontSize: 12 }} onClick={() => setOpen(o => !o)}>
        ↓ {label} <span style={{ fontSize: 9, opacity: 0.8 }}>▼</span>
      </button>
      {open && (
        // z-index baixo de propósito — ver comentário em ReportFilters.tsx
        // (a Header do CRM, sticky z-20, cria seu próprio contexto de
        // empilhamento; qualquer z-index >= 20 aqui compete com ela inteira).
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, minWidth: 190,
          background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)', zIndex: 3, overflow: 'hidden', padding: '4px 0',
        }}>
          {items.map((it, i) => (
            <button key={i} onClick={() => { it.onClick(); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                fontSize: 12, background: 'none', border: 'none', color: '#e8e8e8', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,200,66,0.14)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Ícones dos KPIs (Feather, mesmo traço da sidebar/dashboard) ──────────────

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
}
function CheckClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="8 12 11 15 16 9" /></svg>
}
function ScaleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="3" x2="12" y2="21" /><polyline points="4 8 4 14" /><polyline points="20 8 20 14" /><path d="M4 8l4-3 4 3" /><path d="M12 8l4-3 4 3" /></svg>
}
function UsersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
}
function FileCheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="9 15 11 17 15 13" /></svg>
}

function presenceTone(pct: number): Tone {
  if (pct >= 90) return 'ok'
  if (pct >= 70) return 'warn'
  return 'err'
}

// ─── Modal editar ponto ───────────────────────────────────────────────────────

function EditLogModal({ log, employeeId, employees, onClose }: {
  log: TimeLog | null; employeeId: string; employees: { id: string; name: string }[]; onClose: () => void
}) {
  const isNew = !log
  const createMutation = useCreateManualTimeLog()
  const updateMutation = useUpdateTimeLog()
  const [form, setForm] = useState({
    employee_id: employeeId,
    date: log ? toInputDate(log.created_at) : new Date().toLocaleDateString('en-CA'),
    time: log ? toInputTime(log.created_at) : '08:00',
    type:   (log?.type   ?? 'ENTRADA')   as TimeLog['type'],
    status: (log?.status ?? 'VERIFICADO') as TimeLog['status'],
    notes: log?.notes ?? '',
  })
  const [err, setErr] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const created_at = new Date(`${form.date}T${form.time}:00`).toISOString()
    try {
      if (isNew) {
        await createMutation.mutateAsync({ employee_id: form.employee_id, type: form.type, created_at, notes: form.notes || undefined })
      } else {
        await updateMutation.mutateAsync({ id: log!.id, type: form.type, created_at, status: form.status, notes: form.notes || undefined })
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
          <label className="form-label">Observação</label>
          <input className="form-input" value={form.notes} placeholder="Opcional"
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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

function JustifyModal({ log, employeeId, onClose }: { log: TimeLog | null; employeeId: string; onClose: () => void }) {
  const createMutation = useCreateJustification()
  const [form, setForm] = useState({
    reason: '',
    date: log ? toInputDate(log.created_at) : new Date().toLocaleDateString('en-CA'),
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
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [selectedSector,   setSelectedSector]   = useState<string>('')
  const [showCharts,   setShowCharts]   = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showAlerts,   setShowAlerts]   = useState(false)
  const [expandedLogs, setExpandedLogs] = useState(false)
  const [editLog,    setEditLog]    = useState<TimeLog | null | 'new'>()
  const [justifyLog, setJustifyLog] = useState<TimeLog | null>()
  const [detailLog,  setDetailLog]  = useState<TimeLog | null>(null)
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [innerTab, setInnerTab] = useState<'registros' | 'espelho' | 'anomalias' | 'banco'>('registros')
  const { can } = useAuth()

  const { data: employees = [] } = useEmployees()
  const { data: sectors   = [] } = useSectors()

  const isEmployeeScope = scope === 'employee'
  const subEmpId = isEmployeeScope ? selectedEmployee || null : null

  const { data: mirrorData  } = useMirror(subEmpId, year, month)
  const { data: anomalies = [] } = useAnomalies(subEmpId, year, month)
  const { data: timeBankData } = useTimeBank(subEmpId, year, month)

  // Reset inner tab when switching employee or período
  useEffect(() => {
    setInnerTab('registros')
  }, [selectedEmployee, year, month, scope, period])

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

  useEffect(() => {
    if (!selectedEmployee && sortedEmployees.length > 0) {
      setSelectedEmployee(sortedEmployees[0].id)
    }
  }, [sortedEmployees, selectedEmployee])

  const apiScope    = scope === 'employee' ? 'employees' : scope
  const idsParam    = scope === 'employee' ? selectedEmployee : undefined
  const sectorParam = scope === 'sector'   ? selectedSector  : undefined

  const { data: alerts = [] } = useAlerts(year, month, apiScope, idsParam, sectorParam)

  const isWeek = period === 'week'
  const { start: weekStart, end: weekEnd } = useMemo(() => isoWeekBounds(weekAnchor), [weekAnchor])
  const weekFrom  = toInputDateLocal(weekStart)
  const weekTo    = toInputDateLocal(weekEnd)
  const weekLabel = `${fmtDayMonth(weekStart)} – ${fmtDayMonth(weekEnd)}/${weekEnd.getFullYear()}`

  // Os dois períodos usam hooks separados (endpoints diferentes no backend —
  // ver /reports/summary vs /reports/summary-range); `enabled` evita buscar
  // os dois ao mesmo tempo ao alternar Mensal/Semanal.
  const { data: summaryMonth = [] } = useSummaryReport(year, month, apiScope, idsParam, sectorParam, !isWeek)
  const { data: totalsMonth } = useTotals(year, month, apiScope, idsParam, sectorParam, !isWeek)
  const { data: summaryWeek = [] } = useSummaryReportRange(weekFrom, weekTo, apiScope, idsParam, sectorParam, isWeek)
  const { data: totalsWeek } = useTotalsRange(weekFrom, weekTo, apiScope, idsParam, sectorParam, isWeek)

  const summary      = isWeek ? summaryWeek : summaryMonth
  const serverTotals = isWeek ? totalsWeek  : totalsMonth

  const dailyEmpId = scope === 'employee' ? selectedEmployee : (summary[0]?.employee_id ?? null)
  const { data: dailyData = [] } = useDailyReport(dailyEmpId, year, month)

  const firstDay = isWeek ? weekFrom : `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay  = isWeek ? weekTo   : new Date(year, month, 0).toLocaleDateString('en-CA')

  const { data: logs = [] } = useTimeLogs({
    date_from:   firstDay,
    date_to:     lastDay,
    employee_id: scope === 'employee' ? selectedEmployee : undefined,
    sector_id:   scope === 'sector'   ? selectedSector   : undefined,
  })

  const { data: justifications = [] } = useJustifications(
    scope === 'employee' && selectedEmployee ? { employee_id: selectedEmployee } : undefined
  )

  const deleteLogMutation = useDeleteTimeLog()

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
  }

  function changePeriod(p: typeof period) {
    setPeriod(p); closePanels()
  }

  function onPickEmployee(id: string) {
    setSelectedEmployee(id); closePanels()
  }

  function prevCalMonth() {
    if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function nextCalMonth() {
    if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page animate-in">

      {/* Cabeçalho */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title">Relatórios</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Mensal / Semanal */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: 'var(--mg-border)' }}>
            {(['month', 'week'] as const).map(p => (
              <button key={p} onClick={() => changePeriod(p)}
                style={{
                  padding: '6px 14px', fontSize: 12, border: 'none', cursor: 'pointer',
                  background: period === p ? 'var(--mg-gold)' : 'transparent',
                  color: period === p ? '#111' : 'var(--mg-muted)',
                  fontWeight: period === p ? 700 : 400,
                }}>
                {p === 'month' ? 'Mensal' : 'Semanal'}
              </button>
            ))}
          </div>

          {period === 'month' ? (
            <>
              <select className="form-input" style={{ fontSize: 12, padding: '6px 10px', width: 'auto' }}
                value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select className="form-input" style={{ fontSize: 12, padding: '6px 10px', width: 'auto' }}
                value={year} onChange={e => setYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--mg-bg2)', border: 'var(--mg-border)', borderRadius: 8, padding: '2px 4px' }}>
              <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 14, lineHeight: 1 }}
                onClick={() => setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}>‹</button>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', minWidth: 118, textAlign: 'center' }}>{weekLabel}</span>
              <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 14, lineHeight: 1 }}
                onClick={() => setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}>›</button>
            </div>
          )}

          {isWeek ? (
            <>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => downloadBlob(
                buildExportUrlRange('xlsx', weekFrom, weekTo, apiScope, sectionTitle, weekLabel, idsParam, sectorParam),
                `relatorio_semana_${weekFrom}_${weekTo}.xlsx`)}>
                ↓ XLSX
              </button>
              <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => downloadBlob(
                buildExportUrlRange('pdf', weekFrom, weekTo, apiScope, sectionTitle, weekLabel, idsParam, sectorParam),
                `relatorio_semana_${weekFrom}_${weekTo}.pdf`)}>
                ↓ PDF
              </button>
            </>
          ) : (
            <>
              <ExportDropdown label="XLSX" variant="btn-ghost" items={[
                { label: 'XLSX Simplificado', onClick: () => downloadBlob(
                  buildExportUrl('xlsx', year, month, apiScope, sectionTitle, idsParam, sectorParam),
                  `relatorio_${year}_${String(month).padStart(2,'0')}.xlsx`) },
                { label: 'XLSX Detalhado', onClick: () => downloadBlob(
                  buildCompleteExportUrl('xlsx', year, month, apiScope, sectionTitle, idsParam, sectorParam),
                  `relatorio_completo_${year}_${String(month).padStart(2,'0')}.xlsx`) },
              ]} />
              <ExportDropdown label="PDF" variant="btn-primary" items={[
                { label: 'PDF Simplificado', onClick: () => downloadBlob(
                  buildExportUrl('pdf', year, month, apiScope, sectionTitle, idsParam, sectorParam),
                  `relatorio_${year}_${String(month).padStart(2,'0')}.pdf`) },
                { label: 'PDF Detalhado', onClick: () => downloadBlob(
                  buildCompleteExportUrl('pdf', year, month, apiScope, sectionTitle, idsParam, sectorParam),
                  `relatorio_completo_${year}_${String(month).padStart(2,'0')}.pdf`) },
              ]} />
            </>
          )}
        </div>
      </div>

      {/* Barra de filtros */}
      <ReportFilters
        scope={scope}
        onChangeScope={changeScope}
        employees={sortedEmployees}
        sectorMap={sectorMap}
        sectors={sectors}
        selectedEmployee={selectedEmployee}
        onPickEmployee={onPickEmployee}
        selectedSector={selectedSector}
        onSelectSector={setSelectedSector}
      />

      {/* Cards de métricas */}
      <div className="grid-kpi" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <KpiCard
          icon={<ClockIcon />} tone="neutral"
          label="Horas esperadas"
          value={fmtH(totals.exp)}
          sub="Jornada prevista no período"
        />
        <KpiCard
          icon={<CheckClockIcon />} tone="ok"
          label="Horas trabalhadas"
          value={fmtH(totals.wrk)} valueTone="ok"
          sub="Efetivamente registradas"
        />
        <KpiCard
          icon={<ScaleIcon />} tone={(serverTotals?.total_balance ?? (totals.wrk - totals.exp)) >= 0 ? 'ok' : 'err'}
          label="Saldo"
          value={fmtH(serverTotals?.total_balance ?? (totals.wrk - totals.exp))}
          valueTone={(serverTotals?.total_balance ?? (totals.wrk - totals.exp)) >= 0 ? 'ok' : 'err'}
          sub="Trabalhado − esperado + justificado"
        />
        <KpiCard
          icon={<FileCheckIcon />} tone="gold"
          label="Horas justificadas"
          value={fmtH(totals.just)}
          sub="Abonadas no período"
        />
        <KpiCard
          icon={<UsersIcon />} tone="gold"
          label="Presença"
          value={`${totals.avgPct.toFixed(1)}%`}
          valueTone={presenceTone(totals.avgPct)}
          sub={`${serverTotals?.employee_count ?? summary.length} colaborador(es)`}
        />
      </div>

      {/* Card de registros */}
      <div className="card" style={{ marginBottom: 20 }}>

        {/* Sub-tabs — apenas na visão por colaborador, e só no relatório
            mensal (Espelho/Anomalias/Banco de horas ainda não têm versão
            semanal) */}
        {isEmployeeScope && !isWeek && (
          <div style={{ display: 'flex', borderBottom: '0.5px solid #2a2a28', marginBottom: 16 }}>
            {([
              ['registros',  'Registros',       null               ],
              ['espelho',    'Espelho de ponto', null               ],
              ['anomalias',  'Anomalias',        anomalies.length   ],
              ['banco',      'Banco de horas',   null               ],
            ] as const).map(([key, label, badge]) => (
              <button
                key={key}
                onClick={() => setInnerTab(key)}
                style={{
                  padding: '8px 14px', fontSize: 12,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: innerTab === key ? '#f5c842' : '#666',
                  borderBottom: innerTab === key ? '2px solid #f5c842' : '2px solid transparent',
                  marginBottom: -1, whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { if (innerTab !== key) (e.currentTarget as HTMLElement).style.color = '#aaa' }}
                onMouseLeave={e => { if (innerTab !== key) (e.currentTarget as HTMLElement).style.color = '#666' }}
              >
                {label}
                {badge != null && badge > 0 && (
                  <span style={{
                    marginLeft: 6, background: 'rgba(226,75,74,0.2)', color: 'var(--mg-red)',
                    borderRadius: 10, padding: '1px 6px', fontSize: 10,
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Cabeçalho — título e ações condicionais por aba */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
            {innerTab === 'registros'  && `Registros — ${sectionTitle}`}
            {innerTab === 'espelho'    && `Espelho de ponto — ${sectionTitle}`}
            {innerTab === 'anomalias'  && `Anomalias — ${sectionTitle}`}
            {innerTab === 'banco'      && `Banco de horas — ${sectionTitle}`}
          </div>
          {/* Ações: somente na aba Registros */}
          {innerTab === 'registros' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                onClick={() => setEditLog('new')}>
                + Adicionar ponto
              </button>
            </div>
          )}
        </div>

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
            onOpenDetail={setDetailLog}
            onEditLog={setEditLog}
            onDeleteLog={id => deleteLogMutation.mutate(id)}
            onJustifyLog={setJustifyLog}
            employeeNames={scope !== 'employee' ? employeeNameMap : undefined}
            employeeName={scope === 'employee' ? sectionTitle : undefined}
          />
        )}

        {/* ── Aba Espelho de ponto ───────────────────────────────────────── */}
        {innerTab === 'espelho' && (
          <MirrorTab
            data={mirrorData}
            employeeId={selectedEmployee}
            year={year}
            month={month}
            canManage={can('corrections')}
            onExportPdf={() => downloadBlob(
              buildSubExportUrl('mirror', 'pdf', selectedEmployee, year, month),
              `espelho_${year}_${String(month).padStart(2,'0')}.pdf`
            )}
            onExportXlsx={() => downloadBlob(
              buildSubExportUrl('mirror', 'xlsx', selectedEmployee, year, month),
              `espelho_${year}_${String(month).padStart(2,'0')}.xlsx`
            )}
          />
        )}

        {/* ── Aba Anomalias ──────────────────────────────────────────────── */}
        {innerTab === 'anomalias' && (
          <AnomaliesTab
            anomalies={anomalies}
            onExportXlsx={() => downloadBlob(
              buildSubExportUrl('anomalies', 'xlsx', selectedEmployee, year, month),
              `anomalias_${year}_${String(month).padStart(2,'0')}.xlsx`
            )}
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
            onExportPdf={() => downloadBlob(
              buildSubExportUrl('time-bank', 'pdf', selectedEmployee, year, month),
              `banco_horas_${year}_${String(month).padStart(2,'0')}.pdf`
            )}
            onExportXlsx={() => downloadBlob(
              buildSubExportUrl('time-bank', 'xlsx', selectedEmployee, year, month),
              `banco_horas_${year}_${String(month).padStart(2,'0')}.xlsx`
            )}
          />
        )}

      </div>

      {/* Modais */}
      {detailLog && <LogDetailModal log={detailLog} onClose={() => setDetailLog(null)} />}
      {editLog && (
        <EditLogModal
          log={editLog === 'new' ? null : editLog}
          employeeId={selectedEmployee || sortedEmployees[0]?.id || ''}
          employees={sortedEmployees}
          onClose={() => setEditLog(undefined)}
        />
      )}
      {justifyLog !== undefined && justifyLog !== null && (
        <JustifyModal
          log={justifyLog}
          employeeId={selectedEmployee || ''}
          onClose={() => setJustifyLog(undefined)}
        />
      )}
    </div>
  )
}
