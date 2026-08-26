import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AuditLog } from '../../lib/types'

const PER_PAGE = 30

const ACTION_LABELS: Record<string, string> = {
  status_change: 'Mudança de Status',
  view_complaint: 'Visualização Sigilosa',
  login: 'Login',
  logout: 'Logout',
}

// Port de admin/audit.html + admin.audit_logs() / get_audit_logs().
export default function AdminAudit() {
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data } = useQuery({
    queryKey: ['ouvidoria-audit-logs', actionFilter, page],
    queryFn: async () => {
      let query = supabase.from('audit_logs').select('*, users!audit_logs_user_id_fkey(full_name, email)', { count: 'exact' })
      if (actionFilter) query = query.eq('action', actionFilter)
      const from = (page - 1) * PER_PAGE
      const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + PER_PAGE - 1)
      if (error) throw error
      return { items: (data ?? []) as AuditLog[], total: count ?? 0 }
    },
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="animate-fade">
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          >
            <option value="">Todas as Ações</option>
            <option value="status_change">Mudança de Status</option>
            <option value="view_complaint">Visualização Sigilosa</option>
            <option value="login">Login</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.875rem 1.25rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Data/Hora</th>
                <th style={{ padding: '0.875rem 1.25rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Usuário</th>
                <th style={{ padding: '0.875rem 1.25rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Ação</th>
                <th style={{ padding: '0.875rem 1.25rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Entidade</th>
                <th style={{ padding: '0.875rem 1.25rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {log.created_at ? log.created_at.slice(0, 19).replace('T', ' ') : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      {log.users ? (
                        <>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{log.users.full_name}</span>
                          <br /><span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{log.users.email}</span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Sistema</span>
                      )}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span className={`badge badge-${log.action === 'view_complaint' ? 'warning' : 'info'}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {log.entity_type}{log.entity_id ? ` / ${log.entity_id.slice(0, 8)}...` : ''}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Shield style={{ width: 32, height: 32, marginBottom: '0.5rem', opacity: 0.4, display: 'block', marginInline: 'auto' }} />
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > PER_PAGE && (
          <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{total} registros no total</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {page > 1 && (
                <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 1rem' }} onClick={() => setPage(page - 1)}>Anterior</button>
              )}
              {page * PER_PAGE < total && (
                <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 1rem' }} onClick={() => setPage(page + 1)}>Próximo</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
