import { useState } from 'react'
import {
  useCorrections, useApproveCorrection, useRejectCorrection, useCreateCorrectionBatch,
  type CorrectionRequest,
} from '../hooks/useCorrections'
import { useEmployees } from '../hooks/useEmployees'
import Avatar from '../components/Avatar'
import Badge from '../components/Badge'
import { Modal } from '../components/Modal'
import EmployeeTransferPicker from '../components/EmployeeTransferPicker'

const STATUS_FILTER = ['Todos', 'PENDENTE', 'APROVADO', 'REJEITADO'] as const

const TYPE_ICON: Record<string, string> = {
  ENTRADA: '🟢', SAIDA_ALMOCO: '🍽', RETORNO_ALMOCO: '↩️', SAIDA: '🔴',
}

const LOG_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'ENTRADA',        label: 'Entrada',        icon: '🟢' },
  { value: 'SAIDA_ALMOCO',   label: 'Saída almoço',   icon: '🍽' },
  { value: 'RETORNO_ALMOCO', label: 'Retorno almoço', icon: '↩️' },
  { value: 'SAIDA',          label: 'Saída',          icon: '🔴' },
]

/** Rótulo de seção — maiúsculo, discreto, mesmo padrão do formulário de
 * correção do kiosk (CorrectionFormScreen.tsx), pra manter os dois
 * consistentes visualmente mesmo sendo telas diferentes. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, color: 'var(--mg-muted)', marginBottom: 8,
      textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
    }}>
      {children}
    </div>
  )
}

function CreateCorrectionModal({ onClose }: { onClose: () => void }) {
  const { data: employees = [] } = useEmployees()
  const createBatchMutation = useCreateCorrectionBatch()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [logType, setLogType] = useState('ENTRADA')
  const [time, setTime] = useState('08:00')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [skipped, setSkipped] = useState<string[] | null>(null)
  const [createdCount, setCreatedCount] = useState(0)

  async function handleSave() {
    setErr(''); setSkipped(null)
    if (selected.size === 0) { setErr('Selecione pelo menos um colaborador'); return }
    try {
      const result = await createBatchMutation.mutateAsync({
        employee_ids: [...selected],
        requested_date: date,
        log_type: logType,
        requested_time: time,
        reason: reason.trim() || undefined,
      })
      if (result.skipped.length > 0) {
        // Fica aberto mostrando quem foi pulado — não sobrepõe batida
        // existente, e o admin precisa saber pra tratar esses individualmente.
        setSkipped(result.skipped)
        setCreatedCount(result.created.length)
        setSelected(new Set())
      } else {
        onClose()
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao criar correções') }
  }

  return (
    <Modal open={true} onClose={onClose} title="Adicionar correção de ponto" maxWidth={760}>
      <div>
        <SectionLabel>Data</SectionLabel>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.06)', border: 'var(--mg-border)',
            borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#fff',
            width: '100%', boxSizing: 'border-box', marginBottom: 18,
          }} />

        <SectionLabel>Tipo</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
          {LOG_TYPES.map(t => (
            <button key={t.value} type="button" onClick={() => setLogType(t.value)} style={{
              padding: '12px 10px', borderRadius: 10, fontSize: 12, border: 'none', cursor: 'pointer',
              background: logType === t.value ? 'var(--mg-gold)' : 'rgba(255,255,255,0.06)',
              color: logType === t.value ? '#111' : '#fff',
              fontWeight: logType === t.value ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <SectionLabel>Horário correto</SectionLabel>
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.06)', border: 'var(--mg-border)',
            borderRadius: 8, padding: '10px 14px', fontSize: 20, fontWeight: 600,
            color: '#fff', width: '100%', boxSizing: 'border-box', marginBottom: 18,
          }} />

        <SectionLabel>Motivo (opcional)</SectionLabel>
        <textarea rows={3} value={reason}
          placeholder="Ex: Esqueceu de registrar ao entrar..."
          onChange={e => setReason(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.06)', border: 'var(--mg-border)',
            borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#fff',
            width: '100%', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit',
            marginBottom: 18,
          }} />

        <SectionLabel>Colaboradores</SectionLabel>
        <EmployeeTransferPicker employees={employees} selected={selected} onChange={setSelected} />
      </div>

      {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', margin: '16px 0 0' }}>{err}</div>}

      {skipped && skipped.length > 0 && (
        <div style={{
          fontSize: 12, color: 'var(--mg-gold)', margin: '16px 0 0',
          background: 'rgba(212,168,67,0.08)', border: '0.5px solid rgba(212,168,67,0.3)',
          borderRadius: 8, padding: '10px 12px', lineHeight: 1.5,
        }}>
          {createdCount > 0
            ? `As outras ${createdCount} correção(ões) foram criadas. `
            : 'Nenhuma correção foi criada. '}
          Estes já têm uma batida desse tipo nesse dia — a correção em lote não sobrepõe uma batida existente.
          Corrija individualmente vinculando à batida já registrada:
          <strong> {skipped.join(', ')}</strong>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>
          {skipped ? 'Fechar' : 'Cancelar'}
        </button>
        <button type="button" className="btn-primary" onClick={handleSave}
          disabled={createBatchMutation.isPending || selected.size === 0}>
          {createBatchMutation.isPending
            ? 'Salvando...'
            : `Salvar${selected.size > 0 ? ` (${selected.size})` : ''}`}
        </button>
      </div>
    </Modal>
  )
}

function ReviewModal({ corr, onClose }: { corr: CorrectionRequest; onClose: () => void }) {
  const approveMutation = useApproveCorrection()
  const rejectMutation  = useRejectCorrection()
  const [approvedTime, setApprovedTime] = useState(corr.requested_time)
  const [note, setNote]   = useState('')
  const [err,  setErr]    = useState('')

  async function handleApprove() {
    setErr('')
    try {
      await approveMutation.mutateAsync({ id: corr.id, approved_time: approvedTime, note: note || undefined })
      onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  async function handleReject() {
    setErr('')
    try {
      await rejectMutation.mutateAsync({ id: corr.id, note: note || undefined })
      onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <Modal open={true} onClose={onClose} title="Revisar solicitação" maxWidth={420}>
      {/* Info do funcionário */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: 'var(--mg-border)' }}>
        <Avatar name={corr.employee_name} size={36} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{corr.employee_name}</div>
          <div style={{ fontSize: 12, color: 'var(--mg-muted)' }}>
            Enviado em {new Date(corr.created_at).toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Detalhes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', border: 'var(--mg-border)' }}>
          <div style={{ fontSize: 10, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Data</div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>
            {new Date(corr.requested_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', border: 'var(--mg-border)' }}>
          <div style={{ fontSize: 10, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Tipo</div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>
            {TYPE_ICON[corr.log_type]} {corr.log_type_label}
          </div>
        </div>
      </div>

      {corr.reason && (
        <div className="form-group">
          <label className="form-label">Motivo informado pelo funcionário</label>
          <div style={{ fontSize: 13, color: 'var(--mg-muted)', padding: '8px 12px',
            background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: 'var(--mg-border)', lineHeight: 1.5 }}>
            {corr.reason}
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Horário aprovado</label>
        <input
          className="form-input"
          type="time"
          value={approvedTime}
          onChange={e => setApprovedTime(e.target.value)}
          style={{ fontSize: 18, fontWeight: 600, maxWidth: 120 }}
        />
        <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 4 }}>
          Horário solicitado: <strong>{corr.requested_time}</strong> — edite se necessário antes de aprovar.
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Observação (opcional)</label>
        <input className="form-input" value={note} placeholder="Motivo da aprovação ou rejeição"
          onChange={e => setNote(e.target.value)} />
      </div>

      {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{err}</div>}

      <div className="modal-actions">
        <button className="btn-danger" onClick={handleReject} disabled={rejectMutation.isPending}>
          {rejectMutation.isPending ? '...' : 'Rejeitar'}
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={handleApprove} disabled={approveMutation.isPending}>
          {approveMutation.isPending ? 'Aprovando...' : 'Aprovar'}
        </button>
      </div>
    </Modal>
  )
}

export default function Corrections() {
  const [filter, setFilter] = useState<typeof STATUS_FILTER[number]>('Todos')
  const [reviewing, setReviewing] = useState<CorrectionRequest | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data = [], isLoading } = useCorrections(filter !== 'Todos' ? filter : undefined)
  const pendingCount = data.filter(c => c.status === 'PENDENTE').length

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">
          Correções de ponto
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
          <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => setShowCreate(true)}>
            + Adicionar correção
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
              <th>Horário solicitado</th>
              <th>Motivo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--mg-muted)', padding: 24 }}>Carregando...</td></tr>
            )}
            {data.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="employee-cell">
                    <Avatar name={c.employee_name} size={28} />
                    <span>{c.employee_name}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--mg-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(c.requested_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td>{TYPE_ICON[c.log_type]} {c.log_type_label}</td>
                <td style={{ fontWeight: 600, color: 'var(--mg-gold)' }}>{c.requested_time}</td>
                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--mg-muted)', fontSize: 12 }}>
                  {c.reason || '—'}
                </td>
                <td>
                  <Badge variant={{ PENDENTE: 'warn', APROVADO: 'ok', REJEITADO: 'err' }[c.status] as 'warn'}>
                    {c.status}
                  </Badge>
                </td>
                <td>
                  {c.status === 'PENDENTE' && (
                    <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => setReviewing(c)}>
                      Revisar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && data.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--mg-muted)', padding: 24 }}>
                Nenhuma solicitação {filter !== 'Todos' ? filter.toLowerCase() : ''}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {reviewing && <ReviewModal corr={reviewing} onClose={() => setReviewing(null)} />}
      {showCreate && <CreateCorrectionModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
