import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, downloadCsv } from '../lib/api'
import Badge from '../components/Badge'
import { formatDateTime } from '../utils/date'

interface AuditEntry {
  id: string
  action: string
  entity: string
  entity_id?: string
  performed_by?: string
  company_id: string
  created_at: string
}

const ACTION_VARIANT: Record<string, 'ok' | 'warn' | 'err' | 'neutral'> = {
  CHECKIN: 'ok',
  CREATE_EMPLOYEE: 'neutral',
  UPDATE_EMPLOYEE: 'neutral',
  DEACTIVATE_EMPLOYEE: 'warn',
  REGISTER_FACE: 'neutral',
  APPROVE_JUSTIFICATION: 'ok',
  REJECT_JUSTIFICATION: 'err',
}

export default function AuditLog() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [action, setAction] = useState('')

  const qs = new URLSearchParams()
  if (dateFrom) qs.set('date_from', dateFrom)
  if (dateTo) qs.set('date_to', dateTo)
  if (action) qs.set('action', action)

  const { data, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['audit', dateFrom, dateTo, action],
    queryFn: () => api.get(`/api/v1/audit${qs.toString() ? '?' + qs : ''}`),
  })

  function handleExport() {
    downloadCsv(`/api/v1/audit/export${qs.toString() ? '?' + qs : ''}`, 'audit_log.csv')
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Audit Log</h1>
        <button className="btn-ghost" onClick={handleExport}>Exportar CSV</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          style={{ width: 160 }}
        />
        <input
          className="form-input"
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          style={{ width: 160 }}
        />
        <select
          className="form-input"
          value={action}
          onChange={e => setAction(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="">Todas as ações</option>
          {Object.keys(ACTION_VARIANT).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Realizado por</th>
              <th>Ação</th>
              <th>Entidade</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>Carregando...</td></tr>}
            {(data ?? []).map(entry => (
              <tr key={entry.id}>
                <td style={{ color: 'var(--mg-muted)', whiteSpace: 'nowrap' }}>
                  {formatDateTime(entry.created_at)}
                </td>
                <td>{entry.performed_by || '—'}</td>
                <td>
                  <Badge variant={ACTION_VARIANT[entry.action] ?? 'neutral'}>
                    {entry.action}
                  </Badge>
                </td>
                <td style={{ fontSize: 12, color: 'var(--mg-muted)' }}>
                  {entry.entity} {entry.entity_id ? `· ${entry.entity_id.slice(0, 8)}...` : ''}
                </td>
              </tr>
            ))}
            {!isLoading && !data?.length && (
              <tr><td colSpan={4} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>Nenhum registro</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
