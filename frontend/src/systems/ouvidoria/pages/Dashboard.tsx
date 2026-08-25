import { useQuery } from '@tanstack/react-query'
import { FileText, CircleDot, Clock, CheckCircle2, PlusCircle, Bot, List, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { supabase } from '../lib/supabase'
import { useOuvidoriaProfile } from '../lib/useOuvidoriaProfile'
import { statusBadge, statusLabel } from '../lib/format'
import type { Complaint, DashboardStats } from '../lib/types'

// Port de main/dashboard.html + main.dashboard()/get_dashboard_stats() do
// repo original — aqui como duas queries diretas ao Supabase (RLS já limita
// a "complaints" às do próprio usuário) em vez de endpoint Flask.
export default function Dashboard() {
  const toAbs = useNativeSystemPath()
  const { data: profile } = useOuvidoriaProfile()

  const { data: stats } = useQuery({
    queryKey: ['ouvidoria-dashboard-stats', profile?.id],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase
        .from('complaints')
        .select('status')
        .eq('is_deleted', false)
        .eq('user_id', profile!.id)
      if (error) throw error

      const result: DashboardStats = { total: 0, abertas: 0, em_analise: 0, em_tratativa: 0, concluidas: 0, aguardando: 0 }
      result.total = data?.length ?? 0
      for (const row of data ?? []) {
        if (row.status === 'aberta') result.abertas++
        else if (row.status === 'em_analise') result.em_analise++
        else if (row.status === 'em_tratativa') result.em_tratativa++
        else if (row.status === 'concluida') result.concluidas++
        else if (row.status === 'aguardando_usuario') result.aguardando++
      }
      return result
    },
    enabled: !!profile?.id,
  })

  const { data: recent } = useQuery({
    queryKey: ['ouvidoria-dashboard-recent', profile?.id],
    queryFn: async (): Promise<Complaint[]> => {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('is_deleted', false)
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data as Complaint[]
    },
    enabled: !!profile?.id,
  })

  const firstName = (profile?.full_name || '').split(' ')[0]

  return (
    <>
      <div className="welcome-banner animate-fade">
        <h2>Olá, {firstName} 👋</h2>
        <p>Acompanhe suas manifestações e acesse os recursos da Ouvidoria Corporativa.</p>
      </div>

      <div className="grid-metrics">
        <div className="metric-card animate-fade">
          <div className="metric-icon gold"><FileText /></div>
          <div className="metric-content">
            <div className="metric-value">{stats?.total ?? 0}</div>
            <div className="metric-label">Total de Manifestações</div>
          </div>
        </div>
        <div className="metric-card animate-fade">
          <div className="metric-icon info"><CircleDot /></div>
          <div className="metric-content">
            <div className="metric-value">{stats?.abertas ?? 0}</div>
            <div className="metric-label">Abertas</div>
          </div>
        </div>
        <div className="metric-card animate-fade">
          <div className="metric-icon warning"><Clock /></div>
          <div className="metric-content">
            <div className="metric-value">{(stats?.em_analise ?? 0) + (stats?.em_tratativa ?? 0)}</div>
            <div className="metric-label">Em Andamento</div>
          </div>
        </div>
        <div className="metric-card animate-fade">
          <div className="metric-icon success"><CheckCircle2 /></div>
          <div className="metric-content">
            <div className="metric-value">{stats?.concluidas ?? 0}</div>
            <div className="metric-label">Concluídas</div>
          </div>
        </div>
      </div>

      <div className="grid-2col">
        <div className="card animate-fade">
          <div className="card-header">
            <h3>Ações Rápidas</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link to={toAbs('manifestacoes/nova')} className="btn btn-primary btn-block">
              <PlusCircle /> Nova Manifestação
            </Link>
            <Link to={toAbs('chat')} className="btn btn-secondary btn-block">
              <Bot /> Consultar Assistente IA
            </Link>
            <Link to={toAbs('manifestacoes')} className="btn btn-outline btn-block">
              <List /> Ver Todas as Manifestações
            </Link>
          </div>
        </div>

        <div className="card animate-fade">
          <div className="card-header">
            <h3>Manifestações Recentes</h3>
            <Link to={toAbs('manifestacoes')} className="btn btn-sm btn-outline">Ver todas</Link>
          </div>

          {recent && recent.length > 0 ? (
            <div className="complaint-list">
              {recent.map((c) => (
                <Link key={c.id} to={toAbs(`manifestacoes/${c.id}`)} className="complaint-item" style={{ padding: '0.85rem 1rem' }}>
                  <div className="complaint-item-header">
                    <span className="complaint-item-title" style={{ fontSize: '0.875rem' }}>{c.title}</span>
                    <span className="complaint-item-protocol">{c.protocol}</span>
                  </div>
                  <div className="complaint-item-meta">
                    <span className={`badge badge-${statusBadge(c.status)}`}>{statusLabel(c.status)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ color: 'var(--accent-gold)' }}><ClipboardList style={{ width: 48, height: 48, strokeWidth: 1.5 }} /></div>
              <h3>Nenhuma manifestação</h3>
              <p>Você ainda não registrou nenhuma manifestação na Ouvidoria.</p>
              <Link to={toAbs('manifestacoes/nova')} className="btn btn-primary btn-sm">Abrir Manifestação</Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
