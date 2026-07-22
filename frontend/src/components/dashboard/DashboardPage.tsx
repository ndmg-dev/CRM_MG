import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, UserCheck, Grid3X3, ClipboardList, AlertTriangle, Activity } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import StatCard from './StatCard'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { formatDateTime } from '@/lib/utils'

const stagger: import('framer-motion').Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const fadeUp: import('framer-motion').Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function DashboardPage() {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  useEffect(() => { setCurrentPage('Dashboard') }, [setCurrentPage])

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

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      {/* Welcome */}
      <motion.div variants={fadeUp} className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Bem-vindo de volta 👋</h1>
        <p className="mt-1 text-sm text-text-muted">
          Acompanhe os indicadores do escritório em tempo real.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={fadeUp} className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Users} label="Total de Usuários" value={summary.totalUsuarios} color="#d4a843" />
        <StatCard icon={UserCheck} label="Usuários Ativos" value={summary.usuariosAtivos} color="#22c55e" subtitle="Colaboradores ativos no sistema" />
        <StatCard icon={Grid3X3} label="Sistemas Cadastrados" value={summary.totalSistemas} color="#3b82f6" />
        <StatCard icon={ClipboardList} label="Tarefas Abertas" value={summary.tarefasAbertas} color="#f59e0b" />
        <StatCard icon={AlertTriangle} label="Tarefas Vencidas" value={summary.tarefasVencidas} color="#ef4444" subtitle="Requer atenção imediata" />
        <StatCard icon={Activity} label="SLA do Mês" value="87%" color="#22c55e" trend={{ value: 3, positive: true }} />
      </motion.div>

      {/* Recent Audit Logs */}
      <motion.div variants={fadeUp}>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Atividade Recente</h2>
        <div className="rounded-lg border border-border bg-card">
          {summary.recentAuditLogs.map((log, i) => (
            <div
              key={log.id}
              className={`flex items-center gap-4 px-5 py-3.5 ${
                i < summary.recentAuditLogs.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface">
                <Activity className="h-4 w-4 text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">
                  <span className="font-medium">{log.usuarioNome}</span>
                  {' '}
                  <span className={actionColors[log.acao] || 'text-text-secondary'}>{log.acao}</span>
                </p>
                <p className="truncate text-xs text-text-muted">{log.alvo}</p>
              </div>
              <span className="shrink-0 text-xs text-text-muted">{formatDateTime(log.dataHora)}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
