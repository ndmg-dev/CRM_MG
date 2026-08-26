import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Lock, PlusCircle, ClipboardList } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { supabase } from '../lib/supabase'
import { useOuvidoriaProfile } from '../lib/useOuvidoriaProfile'
import { ALL_STATUSES, categoryLabel, priorityBadge, priorityLabel, statusBadge, statusLabel } from '../lib/format'
import type { Complaint } from '../lib/types'

const PER_PAGE = 10

// Port de ouvidoria/list.html + ouvidoria.list_complaints() — lista das
// PRÓPRIAS manifestações do usuário logado (RLS já restringe a query, não
// precisa filtrar user_id explicitamente, mas mantemos igual ao original
// pra ficar explícito e a query poder usar o índice certo).
export default function ComplaintsList() {
  const toAbs = useNativeSystemPath()
  const { data: profile } = useOuvidoriaProfile()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data } = useQuery({
    queryKey: ['ouvidoria-my-complaints', profile?.id, status, page],
    queryFn: async () => {
      let query = supabase
        .from('complaints')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false)
        .eq('user_id', profile!.id)
      if (status) query = query.eq('status', status)
      const from = (page - 1) * PER_PAGE
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, from + PER_PAGE - 1)
      if (error) throw error
      return { items: (data ?? []) as Complaint[], total: count ?? 0 }
    },
    enabled: !!profile?.id,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>{total} manifestação(ões) encontrada(s)</p>
        </div>
        <div className="page-header-actions">
          <Link to={toAbs('manifestacoes/nova')} className="btn btn-primary">
            <PlusCircle /> Nova Manifestação
          </Link>
        </div>
      </div>

      <div className="filter-bar">
        <select
          className="form-control"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
        >
          <option value="">Todos os Status</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
        {status && (
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setStatus('')}>Limpar Filtro</button>
        )}
      </div>

      {items.length > 0 ? (
        <>
          <div className="complaint-list">
            {items.map((c) => (
              <Link key={c.id} to={toAbs(`manifestacoes/${c.id}`)} className="complaint-item animate-fade">
                <div className="complaint-item-header">
                  <span className="complaint-item-title">{c.title}</span>
                  <span className="complaint-item-protocol">{c.protocol}</span>
                </div>
                <div className="complaint-item-meta">
                  <span className={`badge badge-${statusBadge(c.status)}`}>{statusLabel(c.status)}</span>
                  <span className={`badge badge-${priorityBadge(c.priority)}`}>{priorityLabel(c.priority)}</span>
                  <span>{categoryLabel(c.category)}</span>
                  {c.is_confidential && (
                    <span className="badge badge-gold"><Lock style={{ width: 12, height: 12, marginRight: 4 }} /> Sigiloso</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {page > 1 && (
                <a onClick={() => setPage(page - 1)} style={{ cursor: 'pointer' }}>&larr; Anterior</a>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a key={p} onClick={() => setPage(p)} className={p === page ? 'active' : ''} style={{ cursor: 'pointer' }}>{p}</a>
              ))}
              {page < totalPages && (
                <a onClick={() => setPage(page + 1)} style={{ cursor: 'pointer' }}>Próxima &rarr;</a>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: 'var(--accent-gold)' }}><ClipboardList style={{ width: 48, height: 48, strokeWidth: 1.5 }} /></div>
            <h3>Nenhuma manifestação encontrada</h3>
            <p>{status ? 'Nenhuma manifestação com este filtro.' : 'Você ainda não registrou nenhuma manifestação.'}</p>
            <Link to={toAbs('manifestacoes/nova')} className="btn btn-primary btn-sm">
              <PlusCircle /> Abrir Manifestação
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
