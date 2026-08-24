import { useState } from 'react'
import { useCorrections, useApproveCorrection, useRejectCorrection, type CorrectionRequest } from '../hooks/useCorrections'
import Avatar from '../components/Avatar'
import Badge from '../components/Badge'
import { Modal } from '../components/Modal'

const STATUS_FILTER = ['Todos', 'PENDENTE', 'APROVADO', 'REJEITADO'] as const

const TYPE_ICON: Record<string, string> = {
  ENTRADA: '🟢', SAIDA_ALMOCO: '🍽', RETORNO_ALMOCO: '↩️', SAIDA: '🔴',
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
    </div>
  )
}
