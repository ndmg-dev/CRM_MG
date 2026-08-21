import {
  Users, UserCheck, Grid3X3, ClipboardList, AlertTriangle, Activity,
  Headphones, ListTodo, CalendarClock,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { supabase as suporteSupabase } from '@/systems/central-suporte/integrations/supabase/client'
import { getSystemIcon } from '@/lib/icons'
import { Tabs } from '@mg/ui'
import StatCard from './StatCard'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import SectionCard from '@/components/common/SectionCard'

const CLOSED_TICKET_STATUSES = ['resolved', 'closed', 'canceled']

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.perfil === 'ADMIN' || user?.perfil === 'COORDENADOR'

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // --- KPIs pessoais ---
  const { data: pessoal, isLoading: isLoadingPessoal } = useQuery({
    queryKey: ['dashboard-personal'],
    queryFn: () => api.dashboard.getPersonalSummary(),
    enabled: !!user,
  })

  const { data: chamadosAbertos, isLoading: isLoadingChamados } = useQuery({
    queryKey: ['dashboard-chamados-abertos'],
    queryFn: async () => {
      const { data: { user: suporteUser } } = await suporteSupabase.auth.getUser()
      if (!suporteUser) return 0
      const { count, error } = await suporteSupabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .or(`requester_id.eq.${suporteUser.id},assignee_id.eq.${suporteUser.id}`)
        .not('status', 'in', `(${CLOSED_TICKET_STATUSES.join(',')})`)
        .is('archived_at', null)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!user,
  })

  // --- Sistemas que o usuário acessa ---
  const { data: sistemas = [] } = useQuery({
    queryKey: ['sistemas'],
    queryFn: () => api.sistemas.getAll(),
    enabled: !!user,
  })

  // --- Visão de gestão (admin/coordenador) — só monta a query se for admin ---
  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.getSummary(),
    enabled: isAdmin,
  })

  if (isLoadingPessoal) {
    return <LoadingSpinner label="Carregando dashboard..." />
  }

  const meuDashboard = (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-5">
        {/* KPIs pessoais */}
        <div className="grid grid-cols-1 gap-3 kpi2:grid-cols-2 kpi3:grid-cols-3">
          <StatCard
            icon={Headphones}
            label="Chamados Abertos"
            value={isLoadingChamados ? '—' : (chamadosAbertos ?? 0)}
            tone="info"
          />
          <StatCard
            icon={ListTodo}
            label="Tarefas Pendentes"
            value={pessoal?.pendingTasks ?? 0}
            tone="warning"
          />
          <StatCard
            icon={CalendarClock}
            label="Próximo Prazo"
            value={pessoal?.nextDeadlineLabel ?? '—'}
            tone={pessoal?.nextDeadlineLabel === 'Atrasado' ? 'error' : 'gold'}
          />
        </div>

        {/* Sistemas que você acessa */}
        <SectionCard
          title="Sistemas que Você Acessa"
          actions={
            <button
              onClick={() => navigate('/sistemas')}
              className="text-[11px] font-medium text-gold hover:underline"
            >
              Ver todos
            </button>
          }
        >
          {sistemas.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-text-muted">
              Nenhum sistema disponível.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {sistemas.slice(0, 10).map((s) => {
                const Icon = getSystemIcon(s.icone, s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/sistemas/${s.id}`)}
                    className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors hover:bg-surface/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-muted text-gold">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <span className="line-clamp-2 text-[11px] font-medium leading-tight text-text-primary">
                      {s.nome}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Sidebar */}
      <div className="flex flex-col gap-5">
        <SectionCard title="Meu SLA">
          <div className="flex flex-col items-center gap-3 py-2">
            <div
              className="flex h-32 w-32 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(var(--color-gold) 0% 87%, var(--color-border) 87% 100%)`,
              }}
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-card">
                <span className="text-[22px] font-bold text-text-primary">87%</span>
              </div>
            </div>
            <p className="text-center text-[12px] text-text-muted">
              Cumprimento de prazos no mês
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Próximos Prazos" flush>
          {!pessoal || pessoal.deadlines.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-text-muted">
              Nenhum prazo pendente.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pessoal.deadlines.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{d.name}</span>
                  <span className={`shrink-0 text-[11px] font-medium ${d.dueLabel === 'Atrasado' ? 'text-error' : 'text-text-muted'}`}>
                    {d.dueLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )

  const visaoGestao = (
    <SectionCard title="Métricas Globais">
      {isLoadingSummary || !summary ? (
        <LoadingSpinner label="Carregando métricas..." />
      ) : (
        <div className="grid grid-cols-1 gap-3 kpi2:grid-cols-2 kpi3:grid-cols-3 kpi6:grid-cols-6">
          <StatCard icon={Users} label="Total de Usuários" value={summary.totalUsuarios} tone="gold" />
          <StatCard icon={UserCheck} label="Usuários Ativos" value={summary.usuariosAtivos} tone="success" subtitle="Colaboradores ativos no sistema" />
          <StatCard icon={Grid3X3} label="Sistemas Cadastrados" value={summary.totalSistemas} tone="info" />
          <StatCard icon={ClipboardList} label="Tarefas Abertas" value={summary.tarefasAbertas} tone="warning" />
          <StatCard icon={AlertTriangle} label="Tarefas Vencidas" value={summary.tarefasVencidas} tone="error" subtitle="Requer atenção imediata" />
          <StatCard icon={Activity} label="SLA do Mês" value="87%" tone="success" trend={{ value: 3, positive: true }} />
        </div>
      )}
    </SectionCard>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
            Olá, {user?.nome?.split(' ')[0]}!
          </h1>
          <p className="mt-0.5 text-[12px] text-text-muted">{user?.perfil}</p>
        </div>
        <p className="hidden shrink-0 text-[12px] text-text-muted sm:block">{hoje}</p>
      </div>

      {isAdmin ? (
        <Tabs
          items={[
            { value: 'pessoal', label: 'Meu Dashboard', content: meuDashboard },
            { value: 'gestao', label: 'Visão de Gestão', content: visaoGestao },
          ]}
        />
      ) : (
        meuDashboard
      )}
    </div>
  )
}
