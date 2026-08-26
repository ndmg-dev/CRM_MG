import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, openAttachment } from '../lib/api'
import { Modal } from './Modal'
import type { MirrorResponse, MirrorRow, MirrorCorrection } from '../hooks/useReports'
import { useHomologarMirror, useReabrirMirror } from '../hooks/useReports'
import '../styles/espelho.css'

interface Props {
  data:         MirrorResponse | undefined
  employeeId:   string
  year:         number
  month:        number
  /** Permissão "corrections" — só quem pode aprovar correções homologa/reabre o mês. */
  canManage:    boolean
  onExportPdf:  () => void
  onExportXlsx: () => void
}

const STATUS_BADGE: Record<string, { variant: string; label: string }> = {
  ok:         { variant: 'ok',         label: 'OK' },
  incomplete: { variant: 'incomplete', label: 'Incompleto' },
  absent:     { variant: 'absent',     label: 'Falta' },
  justified:  { variant: 'incomplete', label: 'Falta justificada' },
  holiday:    { variant: 'info',       label: 'Feriado' },
  special:    { variant: 'neutral',    label: 'Jornada esp.' },
  ferias:     { variant: 'info',       label: 'Férias' },
  weekend:    { variant: 'neutral',    label: 'Fim de sem.' },
  future:     { variant: 'neutral',    label: '—' },
}

const OCC_APPROVAL: Record<string, { cls: string; icon: string }> = {
  APROVADO:  { cls: 'approved', icon: '✓' },
  PENDENTE:  { cls: 'pending',  icon: '⏳' },
  REPROVADO: { cls: 'rejected', icon: '✕' },
}

function fmtH(h: number) {
  const sign  = h < 0 ? '−' : h > 0 ? '+' : ''
  const total = Math.round(Math.abs(h) * 60)
  const hh    = Math.floor(total / 60)
  const mm    = total % 60
  return `${sign}${hh}h${mm > 0 ? mm.toString().padStart(2, '0') : ''}`
}

function fmtHPlain(h: number) {
  const total = Math.round(h * 60)
  const hh    = Math.floor(total / 60)
  const mm    = total % 60
  return mm > 0 ? `${hh}h${mm.toString().padStart(2, '0')}` : `${hh}h`
}

function fmtDateTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

type FilterKey = 'todos' | 'pendencia' | 'faltas' | 'incompletos' | 'corrigidos'

// ─── Tooltip de horário corrigido ──────────────────────────────────────────

function CorrectedTime({ value, info }: { value: string; info: MirrorCorrection }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      style={{ position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(o => !o)}
    >
      <span className="esp-time-corrected">{value}</span>
      {open && (
        <span className="esp-tooltip" role="tooltip">
          <div><span className="esp-tooltip-label">Original:</span>{info.original ?? '—'}</div>
          <div><span className="esp-tooltip-label">Corrigido:</span>{value}</div>
          <div><span className="esp-tooltip-label">Por:</span>{info.edited_by} · {fmtDateTime(info.edited_at)}</div>
          {info.reason && <div><span className="esp-tooltip-label">Motivo:</span>{info.reason}</div>}
        </span>
      )}
    </span>
  )
}

function TimeCell({ value, correction }: { value: string | null; correction?: MirrorCorrection }) {
  if (!value) return <span className="esp-time-empty">—</span>
  if (correction) return <CorrectedTime value={value} info={correction} />
  return <span className="esp-time">{value}</span>
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_BADGE[status]
  if (!meta) return null
  return <span className={`esp-badge esp-badge-${meta.variant}`}>{meta.label}</span>
}

// ─── Modal "Solicitar ajuste" ───────────────────────────────────────────────

function RequestAdjustmentModal({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/justifications', {
      employee_id: employeeId,
      date: new Date(`${date}T12:00:00`).toISOString(),
      reason: reason.trim(),
      occurrence_type: 'FALTA_PARCIAL',
      affects_chart: true,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports', 'mirror'] }); onClose() },
    onError: (e: Error) => setErr(e.message),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) { setErr('Descreva o motivo'); return }
    setErr('')
    mutation.mutate()
  }

  return (
    <Modal open onClose={onClose} title="Solicitar ajuste" maxWidth={420}>
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label">Data</label>
          <input className="form-input" type="date" value={date} max={new Date().toLocaleDateString('en-CA')}
            onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Motivo</label>
          <textarea className="form-input" rows={3} value={reason} required
            placeholder="Descreva brevemente. Não informe diagnóstico ou CID."
            onChange={e => setReason(e.target.value)} />
        </div>
        {err && <div style={{ color: 'var(--mg-red)', fontSize: 12, marginBottom: 10 }}>{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Enviando...' : 'Solicitar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Linha (desktop) e card (mobile) do dia ────────────────────────────────

function dayBalance(r: MirrorRow): number | null {
  if (r.status === 'weekend' || r.status === 'holiday' || r.status === 'ferias' || r.status === 'future') return null
  return r.worked_h - r.expected_h
}

function BalanceCell({ row }: { row: MirrorRow }) {
  const bal = dayBalance(row)
  if (bal === null) return <span className="esp-time-empty">—</span>
  if (Math.abs(bal) <= 1 / 6) return <span className="esp-time-empty">—</span> // tolerância de 10min
  return <span style={{ color: bal > 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>{fmtH(bal)}</span>
}

function isNonWorkDay(status: string) {
  return status === 'weekend' || status === 'holiday' || status === 'ferias'
}

function nonWorkLabel(row: MirrorRow) {
  if (row.status === 'holiday') return row.holiday_name ?? 'Feriado'
  if (row.status === 'ferias')  return 'Férias'
  return 'Fim de semana'
}

function DayRow({ row: r }: { row: MirrorRow }) {
  const nonWork = isNonWorkDay(r.status)
  const isAbsent = r.status === 'absent'
  const approvedOcc = r.occurrences.find(o => o.status === 'APROVADO')
  const hasDetail = r.occurrences.length > 0

  return (
    <>
      <div className={`esp-row st-${r.status}`}>
        <div><span className={`esp-cell-day ${isAbsent ? 'is-absent' : ''}`}>{r.date.slice(8)}/{r.date.slice(5, 7)}</span></div>
        <div><span className="esp-cell-weekday">{r.weekday}</span></div>
        {nonWork || isAbsent ? (
          <div className={`esp-cell-merged ${isAbsent ? 'is-absent' : ''} ${r.status === 'ferias' ? 'is-ferias' : ''}`}>
            {isAbsent ? (r.has_justification ? 'Falta justificada' : 'Falta') : nonWorkLabel(r)}
          </div>
        ) : (
          <>
            <div><TimeCell value={r.entrada} correction={r.corrections.entrada} /></div>
            <div><TimeCell value={r.saida_almoco} correction={r.corrections.saida_almoco} /></div>
            <div><TimeCell value={r.retorno_almoco} correction={r.corrections.retorno_almoco} /></div>
            <div><TimeCell value={r.saida} correction={r.corrections.saida} /></div>
            <div>{r.worked_h > 0 ? <span className="esp-worked">{fmtHPlain(r.worked_h)}</span> : <span className="esp-worked-empty">—</span>}</div>
            <div>{r.total_h > 0 ? <span className="esp-worked">{fmtHPlain(r.total_h)}</span> : <span className="esp-worked-empty">—</span>}</div>
            <div>{r.justified_h > 0 ? <span className="esp-worked">{fmtHPlain(r.justified_h)}</span> : <span className="esp-worked-empty">—</span>}</div>
            <div className="esp-time-empty">{r.lunch_minutes != null ? `${r.lunch_minutes}min` : '—'}</div>
          </>
        )}
        {(nonWork || isAbsent) && <div className="esp-time-empty" />}
        {(nonWork || isAbsent) && <div className="esp-time-empty" />}
        {(nonWork || isAbsent) && <div className="esp-time-empty" />}
        {(nonWork || isAbsent) && <div className="esp-time-empty" />}
        <div><BalanceCell row={r} /></div>
        <div className="esp-status-cell" style={{ display: 'flex' }}>
          <StatusBadge status={r.status} />
          {approvedOcc && (
            <span className="esp-badge esp-badge-neutral esp-badge-just approved">
              {approvedOcc.occurrence_type_label} ✓
            </span>
          )}
          {!approvedOcc && r.occurrences[0] && (
            <span className={`esp-badge esp-badge-neutral esp-badge-just ${OCC_APPROVAL[r.occurrences[0].status]?.cls ?? ''}`}>
              {r.occurrences[0].occurrence_type_label} {OCC_APPROVAL[r.occurrences[0].status]?.icon}
            </span>
          )}
        </div>
      </div>
      {hasDetail && (
        <div className="esp-detail-row">
          <div>
            {r.occurrences.map(occ => (
              <div key={occ.id} className="esp-detail-item">
                <span className="esp-detail-time">
                  {occ.start_time && occ.end_time ? `${occ.start_time.slice(0, 5)}–${occ.end_time.slice(0, 5)}`
                    : occ.justified_hours != null ? `${occ.justified_hours}h abonado` : 'Dia inteiro'}
                </span>
                <span>· {occ.occurrence_type_label}</span>
                <span>· {occ.reason}</span>
                <span className={`esp-badge esp-badge-just ${OCC_APPROVAL[occ.status]?.cls ?? ''} esp-badge-neutral`}>
                  {occ.status_label}
                </span>
                {occ.attachment_url && (
                  <button className="esp-detail-attach" onClick={() => openAttachment(occ.attachment_url!)}>
                    Ver anexo
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function DayCard({ row: r }: { row: MirrorRow }) {
  const nonWork = isNonWorkDay(r.status)
  const isAbsent = r.status === 'absent'
  return (
    <div className={`esp-card st-${r.status}`}>
      <div className="esp-card-head">
        <div>
          <span className="esp-card-date">{r.date.slice(8)}/{r.date.slice(5, 7)}</span>
          <span className="esp-card-weekday">{r.weekday}</span>
        </div>
        <div className="esp-card-badges">
          <StatusBadge status={r.status} />
          {r.occurrences[0] && (
            <span className={`esp-badge esp-badge-neutral esp-badge-just ${OCC_APPROVAL[r.occurrences[0].status]?.cls ?? ''}`}>
              {r.occurrences[0].occurrence_type_label} {OCC_APPROVAL[r.occurrences[0].status]?.icon}
            </span>
          )}
        </div>
      </div>
      {nonWork || isAbsent ? (
        <div className="esp-cell-merged" style={{ padding: '4px 0' }}>
          {isAbsent ? (r.has_justification ? 'Falta justificada' : 'Falta') : nonWorkLabel(r)}
        </div>
      ) : (
        <>
          <div className="esp-card-times">
            <TimeCell value={r.entrada} correction={r.corrections.entrada} />
            <TimeCell value={r.saida_almoco} correction={r.corrections.saida_almoco} />
            <TimeCell value={r.retorno_almoco} correction={r.corrections.retorno_almoco} />
            <TimeCell value={r.saida} correction={r.corrections.saida} />
          </div>
          <div className="esp-card-meta">
            Trabalhado {r.worked_h > 0 ? fmtHPlain(r.worked_h) : '—'}
            {r.justified_h > 0 && ` · Justif. ${fmtHPlain(r.justified_h)}`}
            {r.total_h > 0 && ` · Total ${fmtHPlain(r.total_h)}`}
            {r.lunch_minutes != null && ` · Intervalo ${r.lunch_minutes}min`}
            {' · Saldo '}<BalanceCell row={r} />
          </div>
        </>
      )}
      {r.occurrences.map(occ => (
        <div key={occ.id} className="esp-card-meta" style={{ marginTop: 6 }}>
          {occ.justified_hours != null ? `${occ.justified_hours}h abonado` : 'Dia inteiro'} · {occ.occurrence_type_label} · {occ.reason}
          {occ.attachment_url && (
            <button className="esp-detail-attach" style={{ marginLeft: 6 }} onClick={() => openAttachment(occ.attachment_url!)}>
              Ver anexo
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function SummaryCard({ label, value, tone, zero }: { label: string; value: string; tone?: 'green' | 'red'; zero?: boolean }) {
  return (
    <div className={`esp-summary-card ${zero ? 'is-zero' : ''}`}>
      <div className={`esp-summary-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
      <div className="esp-summary-label">{label}</div>
    </div>
  )
}

// ─── Aba Espelho de ponto ──────────────────────────────────────────────────

export default function MirrorTab({ data, employeeId, year, month, canManage, onExportPdf, onExportXlsx }: Props) {
  const [filter, setFilter] = useState<FilterKey>('todos')
  const [showAdjust, setShowAdjust] = useState(false)
  const homologarMutation = useHomologarMirror()
  const reabrirMutation   = useReabrirMirror()

  const rows = data?.rows.filter(r => r.status !== 'future') ?? []
  const summary = data?.summary
  const homologado = summary?.homologado ?? false

  const counts = useMemo(() => ({
    pendencia:    rows.filter(r => r.occurrences.some(o => o.status === 'PENDENTE')).length,
    faltas:       rows.filter(r => r.status === 'absent').length,
    incompletos:  rows.filter(r => r.status === 'incomplete').length,
    corrigidos:   rows.filter(r => Object.keys(r.corrections).length > 0).length,
  }), [rows])

  const filteredRows = rows.filter(r => {
    if (filter === 'pendencia')   return r.occurrences.some(o => o.status === 'PENDENTE')
    if (filter === 'faltas')      return r.status === 'absent'
    if (filter === 'incompletos') return r.status === 'incomplete'
    if (filter === 'corrigidos')  return Object.keys(r.corrections).length > 0
    return true
  })

  function toggleHomologar() {
    if (!employeeId) return
    if (homologado) {
      if (window.confirm('Reabrir este mês para correções?')) reabrirMutation.mutate({ employeeId, year, month })
    } else {
      if (window.confirm('Homologar este mês? Não será mais possível corrigir pontos até reabrir.')) {
        homologarMutation.mutate({ employeeId, year, month })
      }
    }
  }

  if (!data) {
    return (
      <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 32, fontSize: 13 }}>
        Carregando espelho...
      </div>
    )
  }

  return (
    <div className="esp-tab">
      <div className="esp-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {summary && (
            <span className={`esp-chip ${homologado ? 'esp-chip-homologado' : 'esp-chip-aberto'}`}>
              {homologado ? 'Homologado' : 'Aberto'}
            </span>
          )}
          {homologado && summary && (
            <span style={{ fontSize: 11, color: 'var(--mg-muted)' }}>
              {summary.homologado_by ? `por ${summary.homologado_by}` : ''}
              {summary.homologado_em ? ` em ${fmtDateTime(summary.homologado_em)}` : ''}
            </span>
          )}
        </div>
        <div className="esp-actions">
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={onExportPdf}>↓ PDF</button>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={onExportXlsx}>↓ XLSX</button>
          <button className="btn-primary" style={{ fontSize: 12 }} disabled={homologado}
            onClick={() => setShowAdjust(true)}>
            Solicitar ajuste
          </button>
          {canManage && (
            <button className="btn-ghost" style={{ fontSize: 12 }}
              disabled={homologarMutation.isPending || reabrirMutation.isPending}
              onClick={toggleHomologar}>
              {homologado ? 'Reabrir mês' : 'Homologar mês'}
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="esp-state">Nenhum registro neste mês.</div>
      ) : (
        <>
          {summary && (
            <div className="esp-summary">
              <SummaryCard label="Previsto"  value={fmtHPlain(summary.total_expected_h)} />
              <SummaryCard label="Trabalhado" value={fmtHPlain(summary.total_worked_h)} tone="green" />
              <SummaryCard label="Abonado"   value={fmtHPlain(summary.total_justified_h)} zero={summary.total_justified_h === 0} />
              <SummaryCard label="Faltas"    value={fmtHPlain(summary.total_unjustified_h)} tone={summary.total_unjustified_h > 0 ? 'red' : undefined} zero={summary.total_unjustified_h === 0} />
              <SummaryCard label="Saldo do mês" value={fmtH(summary.balance_h)} tone={summary.balance_h < 0 ? 'red' : summary.balance_h > 0 ? 'green' : undefined} />
            </div>
          )}

          <div className="esp-filters">
            <button className={`esp-filter-chip ${filter === 'todos' ? 'active' : ''}`} onClick={() => setFilter('todos')}>Todos</button>
            <button className={`esp-filter-chip ${filter === 'pendencia' ? 'active' : ''}`} onClick={() => setFilter('pendencia')}>Com pendência ({counts.pendencia})</button>
            <button className={`esp-filter-chip ${filter === 'faltas' ? 'active' : ''}`} onClick={() => setFilter('faltas')}>Faltas ({counts.faltas})</button>
            <button className={`esp-filter-chip ${filter === 'incompletos' ? 'active' : ''}`} onClick={() => setFilter('incompletos')}>Incompletos ({counts.incompletos})</button>
            <button className={`esp-filter-chip ${filter === 'corrigidos' ? 'active' : ''}`} onClick={() => setFilter('corrigidos')}>Corrigidos ({counts.corrigidos})</button>
          </div>

          {/* Desktop */}
          <div className="esp-table-wrap">
            <div className="esp-grid">
              <div className="esp-grid-head">
                <div>Data</div><div>Dia</div><div>Entrada</div><div>S. Almoço</div>
                <div>R. Almoço</div><div>Saída</div><div>Trabalhado</div>
                <div>Horas totais</div><div>Horas justif.</div><div>Intervalo</div>
                <div>Saldo</div><div>Status</div>
              </div>
              {filteredRows.map(r => <DayRow key={r.date} row={r} />)}
            </div>
            <div className="esp-legend">✎ horário ajustado manualmente — passe o cursor para ver o registro original</div>
          </div>

          {/* Mobile */}
          <div className="esp-cards">
            {filteredRows.map(r => <DayCard key={r.date} row={r} />)}
          </div>

          {summary && (
            <div className="esp-footer">
              <span>Previsto <strong>{fmtHPlain(summary.total_expected_h)}</strong></span>
              <span>Trabalhado <strong>{fmtHPlain(summary.total_worked_h)}</strong></span>
              <span>Abonado <strong>{fmtHPlain(summary.total_justified_h)}</strong></span>
              <span>Saldo <strong>{fmtH(summary.balance_h)}</strong></span>
            </div>
          )}
        </>
      )}

      {showAdjust && employeeId && (
        <RequestAdjustmentModal employeeId={employeeId} onClose={() => setShowAdjust(false)} />
      )}
    </div>
  )
}
