import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react'
import { openAttachment } from '../lib/api'
import type { MirrorResponse, MirrorRow } from '../hooks/useReports'
import { useHomologarMirror, useReabrirMirror } from '../hooks/useReports'
import { useCreateManualTimeLog, useDiscardTimeLog, useRestoreTimeLog, useUpdateTimeLog, type TimeLog } from '../hooks/useTimeLogs'
import { toInputDate, toInputTime } from '../utils/date'
import { TYPE_LABELS } from '../utils/labels'
import '../styles/espelho.css'

type PunchType = 'ENTRADA' | 'SAIDA_ALMOCO' | 'RETORNO_ALMOCO' | 'SAIDA'
type Filter = 'all' | 'pending' | 'justified'
type Reason = '' | 'Esquecimento de marcação' | 'Falha no relógio/app' | 'Trabalho externo' | 'Atestado/consulta' | 'Erro de marcação' | 'Outro'
type Draft = { date: string; only: number | null; values: string[]; reasons: Reason[]; observations: string[] }
type Change = { index: number; before: string; after: string; log?: TimeLog; reason: Reason; observation: string }
type UndoStep = { kind: 'update'; log: TimeLog } | { kind: 'create'; id: string } | { kind: 'discard'; id: string }
type Toast = { message: string; undo: UndoStep[] | null }

interface Props {
  data: MirrorResponse | undefined
  error: Error | null
  logsLoading: boolean
  logsError: Error | null
  employeeId: string
  year: number
  month: number
  canManage: boolean
  canJustify: boolean
  mode: 'month' | 'week'
  lockedMonths: Set<string>
  logs: TimeLog[]
  onJustifyDay: (date: string) => void
  filterRequest?: number
  focusDate?: string | null
}

const TYPES: PunchType[] = ['ENTRADA', 'SAIDA_ALMOCO', 'RETORNO_ALMOCO', 'SAIDA']
const SUGGESTED = ['08:00', '12:00', '13:00', '17:00']
const REASONS: Reason[] = ['Esquecimento de marcação', 'Falha no relógio/app', 'Trabalho externo', 'Atestado/consulta', 'Erro de marcação', 'Outro']
const FIELDS = ['entrada', 'saida_almoco', 'retorno_almoco', 'saida'] as const

function minutes(value: string): number | null {
  if (!/^\d\d:\d\d$/.test(value)) return null
  const [hour, minute] = value.split(':').map(Number)
  return hour < 24 && minute < 60 ? hour * 60 + minute : null
}

function formatMinutes(value: number, signed = false) {
  const rounded = Math.round(value)
  const prefix = signed ? rounded > 0 ? '+' : rounded < 0 ? '−' : '' : ''
  const amount = Math.abs(rounded)
  return `${prefix}${Math.floor(amount / 60)}h${String(amount % 60).padStart(2, '0')}`
}

function balance(row: MirrorRow) {
  return Math.round((row.worked_h + row.justified_h - row.expected_h) * 60)
}

function preview(row: MirrorRow, values: string[]) {
  const [entry, lunchOut, lunchBack, exit] = values.map(minutes)
  let worked = 0
  if (entry != null && exit != null) {
    worked = lunchOut != null && lunchBack != null
      ? Math.max(0, lunchOut - entry) + Math.max(0, exit - lunchBack)
      : Math.max(0, exit - entry)
  }
  return { worked, balance: worked + Math.round(row.justified_h * 60) - Math.round(row.expected_h * 60) }
}

function dayLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function localIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString()
}

function dayStatus(row: MirrorRow) {
  const labels: Record<string, string> = {
    ok: 'OK', incomplete: 'Incompleto', absent: 'Falta', justified: 'Justificado',
    weekend: 'Folga', holiday: 'Feriado', future: '—', ferias: 'Férias', special: 'Jornada especial',
  }
  return labels[row.status] ?? row.status
}

function isOff(row: MirrorRow) {
  return ['weekend', 'holiday', 'ferias', 'future'].includes(row.status)
}

function noteFor(log: TimeLog | undefined) {
  if (!log?.notes) return ''
  return log.notes
}

export default function MirrorTab({ data, error, logsLoading, logsError, employeeId, year, month, canManage, canJustify, mode, lockedMonths, logs, onJustifyDay, filterRequest, focusDate }: Props) {
  const [filter, setFilter] = useState<Filter>(filterRequest ? 'pending' : 'all')
  const [selectedDate, setSelectedDate] = useState<string | null>(focusDate ?? null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [undoing, setUndoing] = useState(false)
  const firstInput = useRef<HTMLInputElement>(null)
  const updateLog = useUpdateTimeLog()
  const createLog = useCreateManualTimeLog()
  const discardLog = useDiscardTimeLog()
  const restoreLog = useRestoreTimeLog()
  const homologar = useHomologarMirror()
  const reabrir = useReabrirMirror()

  const rows = useMemo(() => data?.rows.filter(row => row.status !== 'future') ?? [], [data])
  const summary = data?.summary
  const homologado = summary?.homologado ?? false
  const logsByDay = useMemo(() => {
    const grouped = new Map<string, TimeLog[]>()
    for (const log of logs) {
      const date = toInputDate(log.created_at)
      grouped.set(date, [...(grouped.get(date) ?? []), log])
    }
    for (const day of grouped.values()) day.sort((a, b) => a.created_at.localeCompare(b.created_at))
    return grouped
  }, [logs])

  useEffect(() => { if (draft) firstInput.current?.focus() }, [draft])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    function handlePanelKey(event: KeyboardEvent) {
      if (!selectedDate || draft) return
      if (event.key === 'Escape') setSelectedDate(null)
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const index = rows.findIndex(row => row.date === selectedDate)
        if (index < 0) return
        event.preventDefault()
        setSelectedDate(rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)))].date)
      }
    }
    window.addEventListener('keydown', handlePanelKey)
    return () => window.removeEventListener('keydown', handlePanelKey)
  }, [selectedDate, draft, rows])

  function matches(row: MirrorRow) {
    return filter === 'all' || filter === 'pending' && (row.status === 'incomplete' || row.status === 'absent') || filter === 'justified' && row.status === 'justified'
  }
  const visible = rows.filter(matches)
  const pendingCount = rows.filter(row => row.status === 'incomplete' || row.status === 'absent').length
  const justifiedCount = rows.filter(row => row.status === 'justified').length
  const selectedRow = rows.find(row => row.date === selectedDate)

  function findPunch(row: MirrorRow, index: number): TimeLog | undefined {
    const value = row[FIELDS[index]]
    if (!value) return undefined
    const selectedId = row.punch_ids?.[FIELDS[index]]
    if (selectedId) return (logsByDay.get(row.date) ?? []).find(log => log.id === selectedId)
    const matches = (logsByDay.get(row.date) ?? []).filter(log => log.type === TYPES[index] && toInputTime(log.created_at) === value)
    return matches.length === 1 ? matches[0] : undefined
  }

  function canEdit(row: MirrorRow) {
    return canManage && !homologado && !lockedMonths.has(row.date.slice(0, 7)) && !logsLoading && !logsError && !isOff(row)
  }

  function begin(row: MirrorRow, only: number | null) {
    if (!canEdit(row) || saving) return
    setSaveError('')
    if (!matches(row)) setFilter('all')
    setSelectedDate(row.date)
    setDraft({
      date: row.date, only,
      values: FIELDS.map((field, index) => row[field] || (only === index ? SUGGESTED[index] : '')),
      reasons: ['', '', '', ''], observations: ['', '', '', ''],
    })
  }

  function setValue(index: number, value: string) {
    setDraft(current => current ? { ...current, values: current.values.map((item, i) => i === index ? value : item) } : current)
  }
  function setReason(index: number, value: Reason) {
    setDraft(current => current ? { ...current, reasons: current.reasons.map((item, i) => i === index ? value : item) } : current)
  }
  function setObservation(index: number, value: string) {
    setDraft(current => current ? { ...current, observations: current.observations.map((item, i) => i === index ? value : item) } : current)
  }

  function getChanges(row: MirrorRow): Change[] {
    if (!draft || draft.date !== row.date) return []
    return draft.values.flatMap((after, index) => {
      const before = row[FIELDS[index]] ?? ''
      if (after === before) return []
      return [{ index, before, after, log: findPunch(row, index), reason: draft.reasons[index], observation: draft.observations[index] }]
    })
  }

  function validChanges(changes: Change[]) {
    return changes.length > 0 && changes.every(change =>
      (!change.before || !!change.log) && (!change.after || minutes(change.after) != null) &&
      !!change.reason && (change.reason !== 'Outro' || !!change.observation.trim()))
  }

  async function revert(step: UndoStep) {
    if (step.kind === 'update') await updateLog.mutateAsync({
      id: step.log.id, type: step.log.type, created_at: step.log.created_at,
      status: step.log.status, notes: step.log.notes ?? '', reason: 'Desfazer alteração',
    })
    else if (step.kind === 'create') await discardLog.mutateAsync({ id: step.id, reason: 'Desfazer inclusão' })
    else await restoreLog.mutateAsync(step.id)
  }

  async function save(row: MirrorRow) {
    const changes = getChanges(row)
    if (!validChanges(changes) || saving) return
    setSaving(true); setSaveError('')
    let completed = 0
    const inverse: UndoStep[] = []
    try {
      for (const change of changes) {
        const notes = `${change.reason}${change.observation.trim() ? ` — ${change.observation.trim()}` : ''}`
        if (change.log && change.after) {
          await updateLog.mutateAsync({ id: change.log.id, type: change.log.type, created_at: localIso(row.date, change.after), status: change.log.status, notes, reason: change.reason, observation: change.observation.trim() || undefined })
          inverse.unshift({ kind: 'update', log: change.log })
        } else if (change.after) {
          const created = await createLog.mutateAsync({ employee_id: employeeId, type: TYPES[change.index], created_at: localIso(row.date, change.after), notes, reason: change.reason, observation: change.observation.trim() || undefined })
          inverse.unshift({ kind: 'create', id: created.id })
        } else if (change.log) {
          await discardLog.mutateAsync({ id: change.log.id, reason: change.reason, observation: change.observation.trim() || undefined })
          inverse.unshift({ kind: 'discard', id: change.log.id })
        }
        completed++
      }
      setDraft(null)
      setToast({ message: `${completed} ${completed === 1 ? 'registro alterado' : 'registros alterados'} em ${row.date.slice(8)}/${row.date.slice(5, 7)}`, undo: inverse })
    } catch (cause) {
      let reverted = true
      for (const step of inverse) {
        try { await revert(step) } catch { reverted = false }
      }
      const detail = cause instanceof Error ? cause.message : 'Não foi possível salvar a batida.'
      setSaveError(completed && !reverted ? `Parte das alterações foi aplicada. Confira o espelho antes de tentar novamente. ${detail}` : `As alterações não foram concluídas. ${detail}`)
    } finally { setSaving(false) }
  }

  async function undo() {
    if (!toast?.undo?.length || undoing) return
    setUndoing(true); setSaveError('')
    try {
      for (const step of toast.undo) await revert(step)
      setToast(null)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Não foi possível desfazer as alterações.')
    } finally { setUndoing(false) }
  }

  function toggleHomologar() {
    if (!employeeId || mode !== 'month') return
    if (homologado) {
      if (window.confirm('Reabrir este mês para correções?')) reabrir.mutate({ employeeId, year, month })
    } else if (window.confirm('Homologar este mês? Não será mais possível corrigir pontos até reabrir.')) {
      homologar.mutate({ employeeId, year, month })
    }
  }

  function onRowKeyDown(event: React.KeyboardEvent, row: MirrorRow) {
    if (event.key === 'Escape' && draft) { event.stopPropagation(); setDraft(null) }
    if (event.key === 'Enter' && draft?.date === row.date && event.target instanceof HTMLInputElement) {
      event.preventDefault(); void save(row)
    }
  }

  function stepSelection(direction: number) {
    const index = rows.findIndex(row => row.date === selectedDate)
    if (index >= 0) setSelectedDate(rows[Math.max(0, Math.min(rows.length - 1, index + direction))].date)
  }

  if (!employeeId) return <div className="esp-state">Selecione um colaborador para ver o espelho.</div>
  if (!data) return <div className="esp-state">{error ? `Não foi possível carregar o espelho: ${error.message}` : 'Carregando espelho...'}</div>

  return <div className="esp-v2">
    <div className="esp-v2-toolbar">
      <div className="esp-v2-filters" aria-label="Filtrar dias">
        {([['all', 'Todos os dias', rows.length], ['pending', 'Pendências', pendingCount], ['justified', 'Justificados', justifiedCount]] as const).map(([key, label, count]) =>
          <button key={key} type="button" className={filter === key ? 'active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} <span>{count}</span></button>)}
      </div>
      <span className="esp-v2-hint">Clique num horário para editá-lo · ✎ edita o dia inteiro · Enter salva, Esc cancela</span>
    </div>
    {mode === 'month' && <div className="esp-v2-month">
      <span className={homologado ? 'closed' : ''}>● Mês {homologado ? 'homologado' : 'aberto'}</span>
      {canManage && <button type="button" onClick={toggleHomologar} disabled={homologar.isPending || reabrir.isPending}>{homologado ? 'Reabrir mês' : 'Homologar mês'}</button>}
    </div>}
    {(homologar.error || reabrir.error || logsError || saveError) && <p className="report-export-error" role="alert">{saveError || homologar.error?.message || reabrir.error?.message || logsError?.message}</p>}
    {logsLoading && <p className="esp-v2-hint" role="status">Carregando batidas...</p>}
    <div className={`esp-v2-layout ${selectedRow ? 'with-panel' : ''}`}>
      <div className="esp-v2-table-wrap">
        <div className="esp-v2-table">
          <div className="esp-v2-head"><span>Dia</span><span>Entrada</span><span>S. almoço</span><span>R. almoço</span><span>Saída</span><span>Trabalhado</span><span>Saldo</span><span>Situação</span><span /></div>
          {visible.length === 0 && <div className="esp-state">Nenhum dia para este filtro.</div>}
          {visible.map(row => {
            const editing = draft?.date === row.date
            const changes = editing ? getChanges(row) : []
            const estimate = editing ? preview(row, draft.values) : null
            const rowBalance = estimate?.balance ?? balance(row)
            const work = estimate?.worked ?? Math.round(row.worked_h * 60)
            const allowed = canEdit(row)
            const merged = isOff(row)
            const dayLogs = logsByDay.get(row.date) ?? []
            const unmatchedPunch = changes.some(change => change.before && !change.log)
            return <div key={row.date} className={`esp-v2-day st-${row.status} ${editing ? 'editing' : ''} ${selectedDate === row.date ? 'selected' : ''}`} onKeyDown={event => onRowKeyDown(event, row)}>
              <div className="esp-v2-main" onClick={() => { if (!editing) setSelectedDate(selectedDate === row.date ? null : row.date) }}>
                <span className="esp-v2-day-name"><strong>{row.date.slice(8)}</strong><small>{row.weekday}</small></span>
                {merged ? <span className="esp-v2-off">{row.status === 'absent' ? 'Falta' : row.holiday_name || dayStatus(row)}</span> : TYPES.map((type, index) => {
                  const value = row[FIELDS[index]]
                  const isInput = editing && (draft.only === null || draft.only === index)
                  const log = findPunch(row, index)
                  return <div key={type} className={`esp-v2-cell ${isInput ? 'input' : ''} ${isInput && draft.values[index] !== (value ?? '') ? 'changed' : ''}`} onClick={event => { event.stopPropagation(); if (!editing) begin(row, index) }}>
                    {isInput ? <><input ref={draft.only === index || draft.only === null && index === 0 ? firstInput : undefined} type="time" value={draft.values[index]} onChange={event => setValue(index, event.target.value)} aria-label={`${TYPE_LABELS[type]} de ${row.date}`} /><button type="button" title="Limpar horário" aria-label={`Limpar ${TYPE_LABELS[type]}`} onClick={event => { event.stopPropagation(); setValue(index, '') }}><X size={13} /></button></>
                      : <span className={value ? '' : 'missing'}>{value || 'faltando'}{(row.corrections[FIELDS[index]] || log?.source === 'MANUAL') && <b title={noteFor(log) || 'Batida ajustada'}>●</b>}</span>}
                  </div>
                })}
                {!merged && <><span className="esp-v2-number">{formatMinutes(work)}</span><span className={`esp-v2-number ${rowBalance >= 0 ? 'positive' : 'negative'}`}>{formatMinutes(rowBalance, true)}</span></>}
                {merged && <><span /><span /></>}
                <span className={`esp-v2-status st-${row.status}`}><i />{dayStatus(row)}</span>
                <span className="esp-v2-edit-action">{allowed && !editing && <button type="button" title="Editar dia" aria-label={`Editar batidas de ${row.date}`} onClick={event => { event.stopPropagation(); begin(row, null) }}><Pencil size={14} /></button>}</span>
              </div>
              {row.occurrences.filter(occ => occ.status === 'APROVADO').map(occ => <div key={occ.id} className="esp-v2-annotation"><b>✓</b>{occ.occurrence_type_label} · {occ.reason}</div>)}
              {!editing && row.adjustments?.map(adjustment => <div key={adjustment.id} className="esp-v2-annotation note"><b>●</b>{TYPE_LABELS[adjustment.type] ?? adjustment.type} {adjustment.action === 'UPDATE' ? `${adjustment.before ?? '—'} → ${adjustment.after ?? '—'}` : adjustment.action === 'CREATE' ? `incluída ${adjustment.after ?? ''}` : adjustment.action === 'DISCARD' ? 'excluída' : 'restaurada'} · {adjustment.reason}{adjustment.observation ? ` — ${adjustment.observation}` : ''}</div>)}
              {!editing && !row.adjustments && dayLogs.filter(log => log.notes).map(log => <div key={log.id} className="esp-v2-annotation note"><b>●</b>{TYPE_LABELS[log.type]} {log.original_created_at ? `${toInputTime(log.original_created_at)} → ` : log.source === 'MANUAL' ? 'incluída ' : ''}{toInputTime(log.created_at)} · {log.notes}</div>)}
              {editing && <div className="esp-v2-editor" onClick={event => event.stopPropagation()}>
                {changes.map(change => <div className="esp-v2-change" key={change.index}>
                  <span>{TYPE_LABELS[TYPES[change.index]]}</span>
                  <span className="esp-v2-change-time">{change.before || 'vazio'} → <b className={change.after ? '' : 'removed'}>{change.after || 'excluir'}</b></span>
                  <select value={change.reason} aria-label={`Justificativa para ${TYPE_LABELS[TYPES[change.index]]}`} onChange={event => setReason(change.index, event.target.value as Reason)}><option value="">Justificativa…</option>{REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}</select>
                  <input type="text" value={change.observation} onChange={event => setObservation(change.index, event.target.value)} placeholder={change.reason === 'Outro' ? 'Descreva o motivo (obrigatório)' : 'Observação (opcional)'} aria-label={`Observação para ${TYPE_LABELS[TYPES[change.index]]}`} />
                </div>)}
                <div className="esp-v2-editor-footer"><span>{unmatchedPunch ? 'Batida não vinculada com segurança ao registro original.' : changes.length ? `${changes.length} ${changes.length === 1 ? 'alteração' : 'alterações'}${validChanges(changes) ? '' : ' · informe a justificativa de cada batida alterada'}` : draft.only === null ? 'Altere os horários desejados' : 'Altere o horário'}</span><div><button type="button" onClick={() => setDraft(null)}>Cancelar</button><button type="button" className="save" disabled={!validChanges(changes) || saving} onClick={() => void save(row)}>{saving ? 'Salvando...' : 'Salvar'}</button></div></div>
              </div>}
            </div>
          })}
          <div className="esp-v2-total"><strong>Total do período</strong><span>{formatMinutes(Math.round((summary?.total_worked_h ?? 0) * 60))}</span><span className={(summary?.balance_h ?? 0) >= 0 ? 'positive' : 'negative'}>{formatMinutes(Math.round((summary?.balance_h ?? 0) * 60), true)}</span></div>
        </div>
      </div>
      {selectedRow && <aside className="esp-v2-panel" aria-label={`Detalhes de ${selectedDate}`}>
        <div className="esp-v2-panel-head"><div><h3>{dayLabel(selectedRow.date)}</h3><span className={`esp-v2-status st-${selectedRow.status}`}><i />{dayStatus(selectedRow)}</span></div><div><button type="button" aria-label="Dia anterior" onClick={() => stepSelection(-1)}><ChevronLeft size={16} /></button><button type="button" aria-label="Próximo dia" onClick={() => stepSelection(1)}><ChevronRight size={16} /></button><button type="button" aria-label="Fechar detalhes" onClick={() => setSelectedDate(null)}><X size={16} /></button></div></div>
        <div className="esp-v2-panel-stats"><div><small>Trabalhado</small><strong>{formatMinutes(Math.round(selectedRow.worked_h * 60))}</strong></div><div><small>Intervalo</small><strong>{selectedRow.lunch_minutes == null ? '—' : formatMinutes(selectedRow.lunch_minutes)}</strong></div><div><small>Saldo</small><strong>{formatMinutes(balance(selectedRow), true)}</strong></div></div>
        <div className="esp-v2-panel-points">{TYPES.map((type, index) => { const log = findPunch(selectedRow, index); const value = selectedRow[FIELDS[index]]; return <div key={type}><strong>{value || '--:--'}</strong><span>{TYPE_LABELS[type]}<small>{log?.original_created_at ? `Original ${toInputTime(log.original_created_at)} · ` : ''}{log?.address || (value ? 'Registro do espelho' : 'Registro não encontrado')}{log?.face_confidence != null ? ` · confiança ${Math.round(log.face_confidence * 100)}%` : ''}</small></span>{canEdit(selectedRow) && <button type="button" onClick={() => begin(selectedRow, index)}>{value ? 'Editar' : '+ Incluir'}</button>}</div> })}</div>
        {selectedRow.occurrences.map(occ => <div key={occ.id} className="esp-v2-panel-occ"><strong>{occ.occurrence_type_label} · {occ.status_label}</strong><p>{occ.reason}</p>{occ.attachment_url && <button type="button" onClick={() => openAttachment(occ.attachment_url!)}>Ver anexo</button>}</div>)}
        {canJustify && !homologado && <button type="button" className="esp-v2-justify" onClick={() => onJustifyDay(selectedRow.date)}>Justificar dia</button>}
      </aside>}
    </div>
    {toast && <div className="esp-v2-toast" role="status">{toast.message}{toast.undo?.length ? <button type="button" disabled={undoing} onClick={() => void undo()}>{undoing ? 'Desfazendo...' : 'Desfazer'}</button> : null}</div>}
  </div>
}
