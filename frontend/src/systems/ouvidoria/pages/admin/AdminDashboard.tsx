import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BarChart2, Lock } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { supabase } from '../../lib/supabase'
import { categoryLabel, priorityBadge, priorityLabel, statusBadge, statusLabel } from '../../lib/format'
import type { AdminDashboardStats, Complaint } from '../../lib/types'

// Port de admin/dashboard.html + admin.dashboard() + get_admin_dashboard_stats()
// + get_sla_stats() + get_department_heatmap() do repo original — tudo isso
// eram 3 queries Supabase separadas no Flask (usando service_role, que
// ignora RLS); aqui viram 3 queries Supabase diretas do client, protegidas
// pela policy `complaints_select_own_or_admin` (libera tudo pra admin).
// TMA/TMR e o heatmap são agregações simples feitas em JS sobre o retorno
// bruto, igual o original fazia em Python.
export default function AdminDashboard() {
  const toAbs = useNativeSystemPath()

  const { data: stats } = useQuery({
    queryKey: ['ouvidoria-admin-dashboard'],
    queryFn: async (): Promise<AdminDashboardStats> => {
      const [allRes, recentRes, resolvedRes, adminMsgsRes, deptRes] = await Promise.all([
        supabase.from('complaints').select('status, category, priority').eq('is_deleted', false),
        supabase
          .from('complaints')
          .select('*, users!complaints_user_id_fkey(full_name, avatar_url)')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('complaints')
          .select('created_at, resolved_at')
          .eq('is_deleted', false)
          .eq('status', 'concluida')
          .not('resolved_at', 'is', null),
        supabase
          .from('complaint_messages')
          .select('complaint_id, created_at')
          .eq('sender_type', 'admin')
          .eq('is_deleted', false)
          .order('created_at', { ascending: true }),
        supabase.from('complaints').select('department').eq('is_deleted', false).not('department', 'is', null),
      ])

      if (allRes.error) throw allRes.error

      const result: AdminDashboardStats = {
        total: 0,
        abertas: 0,
        em_analise: 0,
        em_tratativa: 0,
        concluidas: 0,
        aguardando: 0,
        by_category: {},
        by_priority: {},
        by_department: {},
        recent: (recentRes.data as Complaint[]) ?? [],
        sla: { tma_hours: null, tmr_hours: null },
      }

      const all = allRes.data ?? []
      result.total = all.length
      for (const row of all) {
        if (row.status === 'aberta') result.abertas++
        else if (row.status === 'em_analise') result.em_analise++
        else if (row.status === 'em_tratativa') result.em_tratativa++
        else if (row.status === 'concluida') result.concluidas++
        else if (row.status === 'aguardando_usuario') result.aguardando++
        result.by_category[row.category] = (result.by_category[row.category] ?? 0) + 1
        result.by_priority[row.priority] = (result.by_priority[row.priority] ?? 0) + 1
      }

      // TMR — tempo médio de resolução (created_at -> resolved_at)
      if (resolvedRes.data && resolvedRes.data.length > 0) {
        const deltas = resolvedRes.data
          .map((r) => (new Date(r.resolved_at as string).getTime() - new Date(r.created_at).getTime()) / 3_600_000)
          .filter((d) => Number.isFinite(d))
        if (deltas.length) result.sla.tmr_hours = Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
      }

      // TMA — tempo médio até a 1ª resposta do admin
      if (adminMsgsRes.data && adminMsgsRes.data.length > 0) {
        const firstReply: Record<string, string> = {}
        for (const msg of adminMsgsRes.data) {
          if (!firstReply[msg.complaint_id]) firstReply[msg.complaint_id] = msg.created_at
        }
        const ids = Object.keys(firstReply)
        if (ids.length) {
          const { data: createdRows } = await supabase.from('complaints').select('id, created_at').in('id', ids)
          const createdMap: Record<string, string> = {}
          for (const row of createdRows ?? []) createdMap[row.id] = row.created_at
          const deltas = ids
            .filter((cid) => createdMap[cid])
            .map((cid) => (new Date(firstReply[cid]).getTime() - new Date(createdMap[cid]).getTime()) / 3_600_000)
            .filter((d) => Number.isFinite(d))
          if (deltas.length) result.sla.tma_hours = Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
        }
      }

      // Heatmap por setor
      const heatmap: Record<string, number> = {}
      for (const row of deptRes.data ?? []) {
        const dept = (row.department || '').trim()
        if (dept) heatmap[dept] = (heatmap[dept] ?? 0) + 1
      }
      result.by_department = Object.fromEntries(Object.entries(heatmap).sort((a, b) => b[1] - a[1]))

      return result
    },
  })

  if (!stats) return null

  const maxDept = Math.max(1, ...Object.values(stats.by_department))

  return (
    <>
      <div className="admin-stats-row animate-fade">
        <div className="admin-stat-card">
          <div className="admin-stat-value text-gold">{stats.total}</div>
          <div className="admin-stat-label">Total</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value text-info">{stats.abertas}</div>
          <div className="admin-stat-label">Abertas</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value text-warning">{stats.em_analise + stats.em_tratativa}</div>
          <div className="admin-stat-label">Em Andamento</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value text-success">{stats.concluidas}</div>
          <div className="admin-stat-label">Concluídas</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--accent-gold)' }}>{stats.aguardando}</div>
          <div className="admin-stat-label">Aguardando</div>
        </div>
      </div>

      <div className="grid-2col">
        <div className="card animate-fade">
          <div className="card-header"><h3>Por Categoria</h3></div>
          {Object.keys(stats.by_category).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(stats.by_category).map(([cat, count]) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem' }}>{categoryLabel(cat)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 120, height: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stats.total ? (count / stats.total) * 100 : 0}%`, background: 'var(--accent-gold)', borderRadius: 'var(--radius-full)' }} />
                    </div>
                    <span className="font-semibold" style={{ fontSize: '0.85rem', minWidth: 24, textAlign: 'right' }}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Nenhum dado disponível.</p>
          )}
        </div>

        <div className="card animate-fade">
          <div className="card-header"><h3>Por Prioridade</h3></div>
          {Object.keys(stats.by_priority).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(stats.by_priority).map(([pri, count]) => (
                <div key={pri} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem' }}>{priorityLabel(pri)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 120, height: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stats.total ? (count / stats.total) * 100 : 0}%`, background: 'var(--accent-gold)', borderRadius: 'var(--radius-full)' }} />
                    </div>
                    <span className="font-semibold" style={{ fontSize: '0.85rem', minWidth: 24, textAlign: 'right' }}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Nenhum dado disponível.</p>
          )}
        </div>
      </div>

      <div className="admin-stats-row animate-fade mt-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--info)' }}>{stats.sla.tma_hours != null ? `${stats.sla.tma_hours}h` : '—'}</div>
          <div className="admin-stat-label">TMA — Tempo Médio de 1ª Resposta</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value" style={{ color: 'var(--success)' }}>{stats.sla.tmr_hours != null ? `${stats.sla.tmr_hours}h` : '—'}</div>
          <div className="admin-stat-label">TMR — Tempo Médio de Resolução</div>
        </div>
      </div>

      {Object.keys(stats.by_department).length > 0 && (
        <div className="card animate-fade mt-3">
          <div className="card-header"><h3>Distribuição por Setor</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {Object.entries(stats.by_department).map(([dept, count]) => (
              <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', minWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={dept}>{dept}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / maxDept) * 100}%`, background: 'linear-gradient(90deg, var(--accent-gold-dark, var(--accent-gold)), var(--accent-gold))', borderRadius: 'var(--radius-full)' }} />
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-gold)', minWidth: 24, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card animate-fade mt-3">
        <div className="card-header">
          <h3>Manifestações Recentes</h3>
          <Link to={toAbs('admin/manifestacoes')} className="btn btn-sm btn-outline">Ver todas</Link>
        </div>

        {stats.recent.length > 0 ? (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Título</th>
                  <th>Colaborador</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((c) => (
                  <tr key={c.id}>
                    <td><span className="text-gold font-medium">{c.protocol}</span></td>
                    <td className="truncate" style={{ maxWidth: 250 }}>{c.title}</td>
                    <td>
                      {c.is_confidential ? (
                        <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                          <Lock style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />Sigiloso
                        </span>
                      ) : (
                        c.users?.full_name ?? '—'
                      )}
                    </td>
                    <td><span className={`badge badge-${statusBadge(c.status)}`}>{statusLabel(c.status)}</span></td>
                    <td><span className={`badge badge-${priorityBadge(c.priority)}`}>{priorityLabel(c.priority)}</span></td>
                    <td><Link to={toAbs(`admin/manifestacoes/${c.id}`)} className="btn btn-sm btn-outline">Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: 'var(--accent-gold)' }}><BarChart2 style={{ width: 48, height: 48, strokeWidth: 1.5 }} /></div>
            <h3>Sem manifestações ainda</h3>
            <p>As manifestações registradas aparecerão aqui.</p>
          </div>
        )}
      </div>
    </>
  )
}
