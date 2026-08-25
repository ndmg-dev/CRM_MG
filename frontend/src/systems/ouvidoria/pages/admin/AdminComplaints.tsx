import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FolderOpen, Lock } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { supabase } from '../../lib/supabase'
import {
  ALL_CATEGORIES,
  ALL_PRIORITIES,
  ALL_STATUSES,
  categoryLabel,
  formatDate,
  priorityBadge,
  priorityLabel,
  statusBadge,
  statusLabel,
} from '../../lib/format'
import type { Complaint } from '../../lib/types'

const PER_PAGE = 15

// Port de admin/complaints.html + admin.complaints() — lista TODAS as
// manifestações (RLS libera pra admin via ouvidoria_is_admin()).
export default function AdminComplaints() {
  const toAbs = useNativeSystemPath()
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const { data } = useQuery({
    queryKey: ['ouvidoria-admin-complaints', status, category, priority, search, page],
    queryFn: async () => {
      let query = supabase
        .from('complaints')
        .select('*, users!complaints_user_id_fkey(full_name, email, avatar_url)', { count: 'exact' })
        .eq('is_deleted', false)
      if (status) query = query.eq('status', status)
      if (category) query = query.eq('category', category)
      if (priority) query = query.eq('priority', priority)
      if (search) query = query.or(`title.ilike.%${search}%,protocol.ilike.%${search}%`)

      const from = (page - 1) * PER_PAGE
      const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + PER_PAGE - 1)
      if (error) throw error
      return { items: (data ?? []) as Complaint[], total: count ?? 0 }
    },
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function clearFilters() {
    setStatus('')
    setCategory('')
    setPriority('')
    setSearch('')
    setSearchInput('')
    setPage(1)
  }

  const hasFilters = !!(status || category || priority || search)

  return (
    <>
      <div className="page-header">
        <p className="text-secondary" style={{ fontSize: '0.85rem' }}>{total} manifestação(ões)</p>
      </div>

      <div className="filter-bar">
        <form onSubmit={submitSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', width: '100%', alignItems: 'center' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por título ou protocolo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <select className="form-control" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="">Status</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select className="form-control" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
            <option value="">Categoria</option>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
          <select className="form-control" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1) }}>
            <option value="">Prioridade</option>
            {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
          </select>
          <button type="submit" className="btn btn-sm btn-primary">Buscar</button>
          {hasFilters && <button type="button" className="btn btn-sm btn-secondary" onClick={clearFilters}>Limpar</button>}
        </form>
      </div>

      {items.length > 0 ? (
        <>
          <div className="table-container animate-fade">
            <table className="table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Título</th>
                  <th>Colaborador</th>
                  <th>Categoria</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th>Data</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td><span className="text-gold font-medium">{c.protocol}</span></td>
                    <td className="truncate" style={{ maxWidth: 220 }}>{c.title}</td>
                    <td>
                      {c.is_confidential ? (
                        <div className="d-flex align-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                          <Lock style={{ width: 14, height: 14, flexShrink: 0 }} />
                          <span style={{ fontStyle: 'italic' }}>Sigiloso</span>
                        </div>
                      ) : (
                        <div className="d-flex align-center gap-1">
                          {c.users?.avatar_url && <img src={c.users.avatar_url} className="avatar avatar-sm" referrerPolicy="no-referrer" />}
                          <span>{c.users?.full_name ?? '—'}</span>
                        </div>
                      )}
                    </td>
                    <td>{categoryLabel(c.category)}</td>
                    <td><span className={`badge badge-${statusBadge(c.status)}`}>{statusLabel(c.status)}</span></td>
                    <td><span className={`badge badge-${priorityBadge(c.priority)}`}>{priorityLabel(c.priority)}</span></td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{formatDate(c.created_at)}</td>
                    <td><Link to={toAbs(`admin/manifestacoes/${c.id}`)} className="btn btn-sm btn-outline">Detalhes</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {page > 1 && <a onClick={() => setPage(page - 1)} style={{ cursor: 'pointer' }}>&larr; Anterior</a>}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a key={p} onClick={() => setPage(p)} className={p === page ? 'active' : ''} style={{ cursor: 'pointer' }}>{p}</a>
              ))}
              {page < totalPages && <a onClick={() => setPage(page + 1)} style={{ cursor: 'pointer' }}>Próxima &rarr;</a>}
            </div>
          )}
        </>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: 'var(--accent-gold)' }}><FolderOpen style={{ width: 48, height: 48, strokeWidth: 1.5 }} /></div>
            <h3>Nenhuma manifestação encontrada</h3>
            <p>Ajuste os filtros ou aguarde novas manifestações dos colaboradores.</p>
          </div>
        </div>
      )}
    </>
  )
}
