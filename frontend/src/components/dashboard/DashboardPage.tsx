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

/** Mesmo texto do `_due_label` do backend (dashboard.py), pra "Próximo Prazo"
 *  ficar com a mesma linguagem não importe se a fonte é Tarefa ou chamado. */
function dueLabel(due: Date, now: Date): string {
  const diaDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diaAgora = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dias = Math.round((diaDue.getTime() - diaAgora.getTime()) / 86400000)
  if (dias < 0) return 'Atrasado'
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return `${dias} dias`
}

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

  // --- SLA e próximo prazo via chamados (central-suporte) ---
  // "Meu SLA" e "Próximo Prazo" eram hardcoded (87% fixo, e o prazo só olhava
  // Tarefa — quem trabalha com chamado e não com Tarefa via sempre "—" ali).
  // % de cumprimento = chamados meus RESOLVIDOS este mês, com prazo definido,
  // que foram resolvidos até o due_date — só entre quem teve prazo pra
  // cumprir (chamado sem due_date nunca conta pra cima nem pra baixo).
  const { data: slaChamados } = useQuery({
    queryKey: ['dashboard-sla-chamados'],
    queryFn: async () => {
      const { data: { user: suporteUser } } = await suporteSupabase.auth.getUser()
      if (!suporteUser) return null

      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      const { data: resolvidos, error: erroResolvidos } = await suporteSupabase
        .from('tickets')
        .select('due_date, resolved_at')
        .eq('assignee_id', suporteUser.id)
        .not('due_date', 'is', null)
        .not('resolved_at', 'is', null)
        .gte('resolved_at', inicioMes.toISOString())
      if (erroResolvidos) throw erroResolvidos

      const total = resolvidos?.length ?? 0
      const dentroPrazo = (resolvidos ?? []).filter(
        (t) => new Date(t.resolved_at as string) <= new Date(t.due_date as string),
      ).length
      const percentual = total > 0 ? Math.round((dentroPrazo / total) * 100) : null

      const { data: proximo, error: erroProximo } = await suporteSupabase
        .from('tickets')
        .select('id, title, due_date')
        .eq('assignee_id', suporteUser.id)
        .not('due_date', 'is', null)
        .not('status', 'in', `(${CLOSED_TICKET_STATUSES.join(',')})`)
        .is('archived_at', null)
        .order('due_date', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (erroProximo) throw erroProximo

      return { percentual, totalResolvidosNoMes: total, proximoChamado: proximo }
    },
    enabled: !!user,
  })

  // Visão de gestão: mesmo cálculo, sem filtrar por responsável — todo
  // chamado que o RLS deixar o admin/coordenador enxergar entra na conta.
  const { data: slaGlobal } = useQuery({
    queryKey: ['dashboard-sla-global'],
    queryFn: async () => {
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      const { data: resolvidos, error } = await suporteSupabase
        .from('tickets')
        .select('due_date, resolved_at')
        .not('due_date', 'is', null)
        .not('resolved_at', 'is', null)
        .gte('resolved_at', inicioMes.toISOString())
      if (error) throw error

      const total = resolvidos?.length ?? 0
      const dentroPrazo = (resolvidos ?? []).filter(
        (t) => new Date(t.resolved_at as string) <= new Date(t.due_date as string),
      ).length
      return total > 0 ? Math.round((dentroPrazo / total) * 100) : null
    },
    enabled: isAdmin,
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

  // Próximo prazo: menor entre o 1º prazo de Tarefa (backend) e o due_date do
  // chamado mais próximo (central-suporte) — antes só olhava Tarefa, e quem
  // só trabalha com chamado nunca via nada além de "—" aqui.
  const prazoTarefa = pessoal?.deadlines[0]
  const prazoChamado = slaChamados?.proximoChamado
  // O backend só manda o rótulo pronto pra Tarefa (dueLabel), sem a data
  // crua — não dá pra comparar as duas datas direto sem mudar o schema do
  // backend. Prioriza o chamado quando os dois existem: é a fonte que a
  // maioria de quem usa este dashboard realmente acompanha no dia a dia.
  const proximoPrazoLabel = prazoChamado
    ? dueLabel(new Date(prazoChamado.due_date as string), new Date())
    : (prazoTarefa?.dueLabel ?? '—')

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
            value={proximoPrazoLabel}
            tone={proximoPrazoLabel === 'Atrasado' ? 'error' : 'gold'}
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
            {slaChamados?.percentual === null || slaChamados?.percentual === undefined ? (
              <div className="flex h-32 w-32 items-center justify-center rounded-full border border-border">
                <span className="px-3 text-center text-[12px] text-text-muted">
                  Sem chamado resolvido com prazo este mês ainda
                </span>
              </div>
            ) : (
              <div
                className="flex h-32 w-32 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(var(--color-gold) 0% ${slaChamados.percentual}%, var(--color-border) ${slaChamados.percentual}% 100%)`,
                }}
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-card">
                  <span className="text-[22px] font-bold text-text-primary">{slaChamados.percentual}%</span>
                </div>
              </div>
            )}
            <p className="text-center text-[12px] text-text-muted">
              {/* Antes era um "87%" fixo, igual pra todo mundo — agora é
                  % dos chamados resolvidos por mim este mês (dos que tinham
                  prazo) que fecharam até o vencimento. */}
              Cumprimento de prazos no mês
              {typeof slaChamados?.totalResolvidosNoMes === 'number' && slaChamados.totalResolvidosNoMes > 0 && (
                <> · {slaChamados.totalResolvidosNoMes} chamado{slaChamados.totalResolvidosNoMes === 1 ? '' : 's'}</>
              )}
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
          {/* Antes era "87%" fixo com uma tendência (+3%) também inventada —
              agora é % real de chamados resolvidos no mês (com prazo
              definido) que fecharam até o due_date, entre todos os que o
              RLS deixa este admin/coordenador enxergar. Sem tendência: não
              temos o número do mês passado calculado pra comparar de
              verdade, e um "+3%" chutado é pior que não mostrar nada. */}
          <StatCard
            icon={Activity}
            label="SLA do Mês"
            value={slaGlobal === null || slaGlobal === undefined ? '—' : `${slaGlobal}%`}
            tone="success"
          />
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
