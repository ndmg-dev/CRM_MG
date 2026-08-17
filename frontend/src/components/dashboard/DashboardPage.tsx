import { Users, UserCheck, Grid3X3, ClipboardList, AlertTriangle, Activity } from 'lucide-react'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import StatCard from './StatCard'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import SectionCard from '@/components/common/SectionCard'
import IconBadge from '@/components/common/IconBadge'
import { formatDateTime } from '@/lib/utils'

export default function DashboardPage() {

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.getSummary(),
  })

  if (isLoading || !summary) {
    return <LoadingSpinner label="Carregando dashboard..." />
  }

  const actionColors: Record<string, string> = {
    GRANT_ACCESS: 'text-success',
    REVOKE_ACCESS: 'text-error',
    UPDATE_USER_ROLE: 'text-info',
    UPDATE_USER_STATUS: 'text-warning',
    CREATE_TAREFA: 'text-gold',
    UPDATE_TAREFA_STATUS: 'text-info',
    CREATE_CLIENTE: 'text-success',
    LOGIN_SUCCESS: 'text-text-muted',
    LOGIN_DENIED: 'text-error',
  }

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho compacto — a data à direita, como no sistema de ponto */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[20px] font-semibold leading-tight text-text-primary">Dashboard</h1>
        <p className="hidden shrink-0 text-[12px] text-text-muted sm:block">{hoje}</p>
      </div>

      {/*
        Grid dos KPIs: 1 col < 768 · 2 col 768–1199 · 3 col 1200–1599 · 6 col ≥ 1600.
        Larguras explícitas em px para casar com os breakpoints da especificação,
        que não coincidem com a escala padrão do Tailwind.
      */}
      <div className="grid grid-cols-1 gap-3 kpi2:grid-cols-2 kpi3:grid-cols-3 kpi6:grid-cols-6">
        <StatCard icon={Users} label="Total de Usuários" value={summary.totalUsuarios} tone="gold" />
        <StatCard icon={UserCheck} label="Usuários Ativos" value={summary.usuariosAtivos} tone="success" subtitle="Colaboradores ativos no sistema" />
        <StatCard icon={Grid3X3} label="Sistemas Cadastrados" value={summary.totalSistemas} tone="info" />
        <StatCard icon={ClipboardList} label="Tarefas Abertas" value={summary.tarefasAbertas} tone="warning" />
        <StatCard icon={AlertTriangle} label="Tarefas Vencidas" value={summary.tarefasVencidas} tone="error" subtitle="Requer atenção imediata" />
        <StatCard icon={Activity} label="SLA do Mês" value="87%" tone="success" trend={{ value: 3, positive: true }} />
      </div>

      {/* Atividade recente — painel tabular */}
      <SectionCard title="Atividade Recente" flush>
        {summary.recentAuditLogs.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-text-muted">
            Nenhuma atividade registrada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {summary.recentAuditLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-surface/50 sm:flex-row sm:items-center sm:gap-3"
              >
                <IconBadge icon={Activity} tone="neutral" size="sm" />

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text-primary">
                    <span className="font-medium">{log.usuarioNome}</span>{' '}
                    <span className={actionColors[log.acao] || 'text-text-secondary'}>{log.acao}</span>
                  </p>
                  <p className="truncate text-[11px] text-text-muted">{log.alvo}</p>
                </div>

                <span className="shrink-0 text-[11px] tabular-nums text-text-muted sm:text-right">
                  {formatDateTime(log.dataHora)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
