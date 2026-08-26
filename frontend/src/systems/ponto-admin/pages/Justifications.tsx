import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, uploadAttachment, openAttachment } from '../lib/api'
import { useEmployees } from '../hooks/useEmployees'
import Badge from '../components/Badge'
import Avatar from '../components/Avatar'
import { formatDate } from '../utils/date'
import { Modal } from '../components/Modal'
import JustificationDetailModal from '../components/JustificationDetailModal'

type OccurrenceType = 'FALTA_INTEGRAL' | 'FALTA_PARCIAL' | 'ATRASO' | 'SAIDA_ANTECIPADA' | 'ABONO' | 'LOCAL_EXTERNO'

interface Justification {
  id: string
  reason: string
  date: string
  status: 'PENDENTE' | 'APROVADO' | 'REPROVADO'
  created_at: string
  employee_id: string
  company_id: string
  occurrence_type?: OccurrenceType
  start_time?: string | null
  end_time?: string | null
  justified_hours?: number | null
  affects_chart?: boolean
  attachment_url?: string | null
  // Agrupa os N registros (um por dia) de um atestado de vários dias criado
  // numa chamada só — ver POST /justifications/batch. Registros avulsos não
  // têm batch_id.
  batch_id?: string | null
  // Só vem preenchido para occurrence_type === LOCAL_EXTERNO — endereço/coords
  // da batida vinculada, pra mostrar onde o ponto foi registrado.
  time_log_address?: string | null
  time_log_latitude?: number | null
  time_log_longitude?: number | null
  created_by_name?: string | null
  reviewed_by_name?: string | null
  reviewed_at?: string | null
}

/** Uma linha renderizável na tabela: ou uma justificativa avulsa, ou um
 * atestado de vários dias representado pela sua primeira linha (mesmo
 * status/reason em todas — só é criado e só muda de estado em lote). */
interface JustificationRow {
  key: string
  rows: Justification[]
  isBatch: boolean
}

function groupByBatch(data: Justification[]): JustificationRow[] {
  const seen = new Set<string>()
  const out: JustificationRow[] = []
  for (const j of data) {
    if (j.batch_id) {
      if (seen.has(j.batch_id)) continue
      seen.add(j.batch_id)
      const rows = data.filter(x => x.batch_id === j.batch_id).sort((a, b) => a.date.localeCompare(b.date))
      out.push({ key: j.batch_id, rows, isBatch: true })
    } else {
      out.push({ key: j.id, rows: [j], isBatch: false })
    }
  }
  return out
}

const STATUS_FILTER = ['Todos', 'PENDENTE', 'APROVADO', 'REPROVADO'] as const

const OCCURRENCE_TYPE_OPTIONS: { value: OccurrenceType; label: string }[] = [
  { value: 'FALTA_INTEGRAL',    label: 'Falta integral (dia todo)' },
  { value: 'FALTA_PARCIAL',     label: 'Falta parcial (com horário)' },
  { value: 'ATRASO',            label: 'Atraso' },
  { value: 'SAIDA_ANTECIPADA',  label: 'Saída antecipada' },
  { value: 'ABONO',             label: 'Abono' },
  // O coordenador cria isso manualmente quando sabe de antemão (ou fica
  // sabendo depois) que o colaborador vai bater ponto de fora da empresa
  // (home office, cliente etc.) — não é gerado automaticamente pelo kiosk.
  { value: 'LOCAL_EXTERNO',     label: 'Ponto fora do local (home office, cliente etc.)' },
]

const OCCURRENCE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  OCCURRENCE_TYPE_OPTIONS.map(o => [o.value, o.label]),
)

function hoursBetween(start: string, end: string): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : null
}

// ─── Modal criar justificativa ────────────────────────────────────────────────

function CreateModal({ employees, onClose }: { employees: { id: string; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient()
  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/api/v1/justifications', data),
  })
  // Atestado de vários dias: uma chamada só ao /batch — o backend cria todos
  // os dias numa transação (tudo ou nada, sem mais "criado 3 de 5 dias").
  const createBatchMutation = useMutation({
    mutationFn: (data: object) => api.post('/api/v1/justifications/batch', data),
  })
  const [form, setForm] = useState({
    employee_id: employees[0]?.id ?? '',
    date: new Date().toLocaleDateString('en-CA'),
    end_date: '',
    reason: '',
    occurrence_type: 'FALTA_INTEGRAL' as OccurrenceType,
    start_time: '',
    end_time: '',
    justified_hours: '',
    affects_chart: true,
    attachment_url: '',
  })
  const [err, setErr] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')

  const hasTimes = !!(form.start_time && form.end_time)
  const computedHours = hasTimes ? hoursBetween(form.start_time, form.end_time) : null

  // Falta integral/abono são sempre dia inteiro — não faz sentido carregar
  // horário/horas parciais junto (já visto em produção: "Falta integral"
  // com 2.5h preenchidas). Local externo já carrega o horário da batida
  // vinculada, então fica de fora dessa exigência.
  const wholeDayOnly    = form.occurrence_type === 'FALTA_INTEGRAL' || form.occurrence_type === 'ABONO'
  const partialRequired = !wholeDayOnly && form.occurrence_type !== 'LOCAL_EXTERNO'
  // Só um dos dois horários preenchido não é um intervalo válido — o payload
  // manda os dois como null nesse caso (ver handleSave), então isso NÃO conta
  // como "preenchido" (senão a validação passa mas nada é enviado de fato).
  const onlyOneTime      = !!(form.start_time || form.end_time) && !hasTimes
  const hasPartialFilled = hasTimes || !!form.justified_hours

  function changeOccurrenceType(occurrence_type: OccurrenceType) {
    const wholeDay = occurrence_type === 'FALTA_INTEGRAL' || occurrence_type === 'ABONO'
    setForm(f => ({
      ...f, occurrence_type,
      ...(wholeDay ? { start_time: '', end_time: '', justified_hours: '' } : { end_date: '' }),
    }))
  }

  const isRange = wholeDayOnly && !!form.end_date && form.end_date > form.date

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(''); setUploading(true)
    try {
      const { attachment_url } = await uploadAttachment('/api/v1/justifications/attachments', file)
      setForm(f => ({ ...f, attachment_url }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar anexo')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setProgress('')
    if (!form.reason.trim()) { setErr('Informe o motivo'); return }
    if (onlyOneTime) { setErr('Preencha os dois horários do intervalo (início e fim), ou deixe ambos em branco'); return }
    if (hasTimes && computedHours === null) { setErr('Horário final deve ser depois do horário inicial'); return }
    if (wholeDayOnly && hasPartialFilled) { setErr('Falta integral/abono não pode ter horário ou horas parciais — deixe em branco para dia inteiro'); return }
    if (partialRequired && !hasPartialFilled) { setErr('Informe o horário real ou as horas justificadas para este tipo de ocorrência'); return }

    try {
      if (isRange) {
        setProgress('Criando atestado...')
        await createBatchMutation.mutateAsync({
          employee_id: form.employee_id,
          date: new Date(`${form.date}T12:00:00`).toISOString(),
          date_end: new Date(`${form.end_date}T12:00:00`).toISOString(),
          reason: form.reason.trim(),
          occurrence_type: form.occurrence_type,
          affects_chart: form.affects_chart,
          attachment_url: form.attachment_url || null,
        })
      } else {
        await createMutation.mutateAsync({
          employee_id: form.employee_id,
          date: new Date(`${form.date}T12:00:00`).toISOString(),
          reason: form.reason.trim(),
          occurrence_type: form.occurrence_type,
          start_time: hasTimes ? form.start_time : null,
          end_time: hasTimes ? form.end_time : null,
          // Ignorado pelo backend quando start_time/end_time vêm preenchidos
          // (ele recalcula a partir do intervalo) — só é usado sem horário.
          justified_hours: hasTimes ? null : (form.justified_hours ? parseFloat(form.justified_hours) : null),
          affects_chart: form.affects_chart,
          attachment_url: form.attachment_url || null,
        })
      }
    } catch (e) {
      setProgress('')
      setErr(e instanceof Error ? e.message : 'Não foi possível criar a justificativa.')
      return
    }
    setProgress('')
    qc.invalidateQueries({ queryKey: ['justifications'] })
    onClose()
  }

  return (
    <Modal open={true} onClose={onClose} title="Nova justificativa" maxWidth={440}>
      <form onSubmit={handleSave}>
        <div className="form-group">
          <label className="form-label">Funcionário</label>
          <select className="form-input" value={form.employee_id}
            onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Data</label>
            <input className="form-input" type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value, end_date: '' }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Até (atestado de vários dias)</label>
            <input className="form-input" type="date" value={form.end_date} min={form.date}
              disabled={!wholeDayOnly}
              title={!wholeDayOnly ? 'Só disponível para falta integral/abono' : undefined}
              onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-input" value={form.occurrence_type}
            onChange={e => changeOccurrenceType(e.target.value as OccurrenceType)}>
            {OCCURRENCE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Motivo</label>
          <textarea className="form-input" rows={3} value={form.reason} required
            placeholder="Descreva o motivo da justificativa (ex: Consulta médica)"
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">
            Intervalo real (ex.: saída 09:00, retorno 11:00){wholeDayOnly ? '' : partialRequired ? '' : ' — opcional'}
            {wholeDayOnly && ' — não se aplica a falta integral/abono'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input className="form-input" type="time" value={form.start_time} disabled={wholeDayOnly}
              onChange={e => setForm(f => ({ ...f, start_time: e.target.value, end_date: '' }))} />
            <input className="form-input" type="time" value={form.end_time} disabled={wholeDayOnly}
              onChange={e => setForm(f => ({ ...f, end_time: e.target.value, end_date: '' }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">
              {hasTimes ? 'Horas justificadas (calculado)'
                : wholeDayOnly ? 'Horas justificadas (dia inteiro)'
                : 'Horas justificadas'}
            </label>
            <input className="form-input" type="number" step="0.5" min="0.5" max="12"
              value={hasTimes ? (computedHours ?? '') : form.justified_hours}
              placeholder="Ex: 2" disabled={hasTimes || wholeDayOnly}
              onChange={e => setForm(f => ({ ...f, justified_hours: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Afeta relatório</label>
            <div style={{ display: 'flex', alignItems: 'center', height: 38, gap: 10 }}>
              <label className="toggle">
                <input type="checkbox" checked={form.affects_chart}
                  onChange={e => setForm(f => ({ ...f, affects_chart: e.target.checked }))} />
                <span className="toggle-slider" />
              </label>
              <span style={{ fontSize: 12, color: 'var(--mg-muted)' }}>
                {form.affects_chart ? 'Sim' : 'Não'}
              </span>
            </div>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Anexo (atestado) — opcional</label>
          <input className="form-input" type="file" accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange} disabled={uploading} />
          {uploading && <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 4 }}>Enviando...</div>}
          {form.attachment_url && !uploading && (
            <div style={{ fontSize: 11, color: 'var(--mg-green)', marginTop: 4 }}>Anexo enviado ✓</div>
          )}
        </div>
        {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary"
            disabled={createMutation.isPending || createBatchMutation.isPending || uploading}>
            {progress || (createMutation.isPending || createBatchMutation.isPending ? 'Salvando...' : 'Criar justificativa')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Justifications() {
  const [filter,     setFilter]     = useState<typeof STATUS_FILTER[number]>('Todos')
  const [showCreate, setShowCreate] = useState(false)
  const [detailRow,  setDetailRow]  = useState<JustificationRow | null>(null)
  const qc = useQueryClient()
  const { data: employees = [] } = useEmployees()

  // Busca sempre tudo e filtra no cliente — um filtro de status na querystring
  // faz um registro conflitante (ex.: já reprovado) sumir da tela sem deixar
  // rastro, o que já causou confusão num 409 que não batia com o que aparecia
  // pro usuário (nenhuma justificativa daquele status visível ali).
  const { data: allData, isLoading } = useQuery<Justification[]>({
    queryKey: ['justifications'],
    queryFn: () => api.get('/api/v1/justifications'),
  })
  const data = filter === 'Todos' ? allData : allData?.filter(j => j.status === filter)

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/justifications/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
  })
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/justifications/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
  })
  // Um atestado de vários dias sempre aprova/recusa inteiro — os dias que o
  // compõem não têm ação individual, só a do lote.
  const approveBatchMutation = useMutation({
    mutationFn: (batchId: string) => api.patch(`/api/v1/justifications/batch/${batchId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
  })
  const rejectBatchMutation = useMutation({
    mutationFn: (batchId: string) => api.patch(`/api/v1/justifications/batch/${batchId}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/justifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
    onError: (e: unknown) => alert(e instanceof Error ? e.message : 'Erro ao excluir'),
  })
  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: string) => api.delete(`/api/v1/justifications/batch/${batchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['justifications'] }),
    onError: (e: unknown) => alert(e instanceof Error ? e.message : 'Erro ao excluir'),
  })

  const employeeMap = Object.fromEntries((employees ?? []).map(e => [e.id, e]))
  const pendingCount = (allData ?? []).filter(j => j.status === 'PENDENTE').length
  const rows = groupByBatch(data ?? [])

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">
          Justificativas
          {pendingCount > 0 && (
            <span className="badge badge-warn" style={{ marginLeft: 10, fontSize: 11 }}>
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {STATUS_FILTER.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={filter === s ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '6px 12px', fontSize: 12 }}>
              {s}
            </button>
          ))}
          <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ fontSize: 12 }}>
            + Nova justificativa
          </button>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Motivo</th>
              <th>Horário / Horas</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>Carregando...</td></tr>}
            {rows.map(({ key, rows: batchRows, isBatch }) => {
              const j = batchRows[0]
              const last = batchRows[batchRows.length - 1]
              const emp = employeeMap[j.employee_id]
              const onApprove = () => isBatch ? approveBatchMutation.mutate(key) : approveMutation.mutate(j.id)
              const onReject  = () => isBatch ? rejectBatchMutation.mutate(key)  : rejectMutation.mutate(j.id)
              const pending = isBatch
                ? approveBatchMutation.isPending || rejectBatchMutation.isPending
                : approveMutation.isPending || rejectMutation.isPending
              return (
                <tr key={key} style={{ cursor: 'pointer' }}
                  onClick={e => { if ((e.target as HTMLElement).closest('button')) return; setDetailRow({ key, rows: batchRows, isBatch }) }}>
                  <td>
                    <div className="employee-cell">
                      <Avatar name={emp?.name ?? '?'} size={28} />
                      <span>{emp?.name ?? j.employee_id}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--mg-muted)' }}>
                    {isBatch && batchRows.length > 1
                      ? `${formatDate(j.date)} – ${formatDate(last.date)}`
                      : formatDate(j.date)}
                    {isBatch && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--mg-muted)', opacity: 0.7 }}
                        title="Atestado de vários dias — aprovar/recusar afeta todos os dias">
                        📎{batchRows.length}d
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {OCCURRENCE_TYPE_LABEL[j.occurrence_type ?? 'FALTA_INTEGRAL'] ?? j.occurrence_type}
                  </td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {j.reason}
                    {j.attachment_url && (
                      <button
                        onClick={() => openAttachment(j.attachment_url!)}
                        style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                        title="Ver anexo"
                      >📎</button>
                    )}
                  </td>
                  <td style={{ color: 'var(--mg-muted)', fontSize: 12 }}>
                    {j.occurrence_type === 'LOCAL_EXTERNO' && j.time_log_latitude != null && j.time_log_longitude != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${j.time_log_latitude},${j.time_log_longitude}`}
                        target="_blank" rel="noreferrer"
                        title={j.time_log_address ?? undefined}
                      >
                        {j.time_log_address ?? `${j.time_log_latitude.toFixed(4)}, ${j.time_log_longitude.toFixed(4)}`}
                      </a>
                    ) : j.start_time && j.end_time
                      ? `${j.start_time.slice(0, 5)}–${j.end_time.slice(0, 5)}`
                      : j.justified_hours != null ? `${j.justified_hours}h` : 'Dia inteiro'}
                  </td>
                  <td>
                    <Badge variant={{ PENDENTE: 'warn', APROVADO: 'ok', REPROVADO: 'err' }[j.status] as 'warn'}>
                      {j.status}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {j.status === 'PENDENTE' && (
                        <>
                          <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={onApprove} disabled={pending}>
                            Aprovar
                          </button>
                          <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={onReject} disabled={pending}>
                            Reprovar
                          </button>
                        </>
                      )}
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
                        disabled={deleteMutation.isPending || deleteBatchMutation.isPending}
                        onClick={() => {
                          if (!confirm(isBatch
                            ? `Excluir o atestado inteiro (${batchRows.length} dia(s))? Essa ação não pode ser desfeita.`
                            : 'Excluir esta justificativa? Essa ação não pode ser desfeita.')) return
                          isBatch ? deleteBatchMutation.mutate(key) : deleteMutation.mutate(j.id)
                        }}>
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!isLoading && !rows.length && (
              <tr><td colSpan={7} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>Nenhuma justificativa</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateModal
          employees={employees
            .filter(e => e.is_active)
            .map(e => ({ id: e.id, name: e.name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))}
          onClose={() => setShowCreate(false)}
        />
      )}
      {detailRow && (
        <JustificationDetailModal
          justification={detailRow.rows[0]}
          employeeName={employeeMap[detailRow.rows[0].employee_id]?.name ?? detailRow.rows[0].employee_id}
          dateRangeLabel={detailRow.isBatch && detailRow.rows.length > 1
            ? `${formatDate(detailRow.rows[0].date)} – ${formatDate(detailRow.rows[detailRow.rows.length - 1].date)} (${detailRow.rows.length} dias)`
            : undefined}
          onClose={() => setDetailRow(null)}
        />
      )}
    </div>
  )
}
