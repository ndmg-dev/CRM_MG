import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, Users, Clock, Monitor, Eye, ChevronDown,
  LogIn, LogOut, Globe, Smartphone, Shield, Trophy
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import PageHeader from '@/components/common/PageHeader'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import type { AuditLog, UserSession, SystemAccessLog, SystemUsageSummary } from '@/types'

type AuditTab = 'overview' | 'sessions' | 'systems' | 'logs'

function formatDuration(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min ${s}s`
  return `${s}s`
}

function timeAgo(dateStr: string): string {
  const tzString = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('-') && dateStr.split('T')[1]?.includes('-') ? dateStr : `${dateStr}Z`
  const now = new Date()
  const date = new Date(tzString)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora mesmo'
  if (diffMin < 60) return `há ${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `há ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `há ${diffD}d`
}

function getDeviceIcon(userAgent?: string) {
  if (!userAgent) return <Globe className="h-4 w-4 text-text-muted" />
  if (/mobile|android|iphone/i.test(userAgent)) return <Smartphone className="h-4 w-4 text-blue-400" />
  return <Monitor className="h-4 w-4 text-emerald-400" />
}

function getBrowserName(userAgent?: string): string {
  if (!userAgent) return 'Desconhecido'
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome'
  if (/firefox/i.test(userAgent)) return 'Firefox'
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari'
  if (/edge/i.test(userAgent)) return 'Edge'
  return 'Outro'
}

// ─── Overview Tab ────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: activeSessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['sessions-ativas'],
    queryFn: () => api.sessoes.getAtivas(),
    refetchInterval: 30_000, // Refresh every 30s
  })

  const { data: auditLogs } = useQuery({
    queryKey: ['auditoria-recent'],
    queryFn: () => api.auditoria.getAll({ }),
  })

  const { data: trackingResumo } = useQuery({
    queryKey: ['tracking-resumo'],
    queryFn: () => api.tracking.getResumo(),
  })

  const acoesHoje = auditLogs?.totalElements ?? 0
  const sistemaMaisUsado = trackingResumo?.topSistemas?.[0]?.sistemaNome ?? '—'

  const stats = [
    { label: 'Usuários Online', value: activeSessions.length, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Ações Hoje', value: acoesHoje, icon: Activity, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Sistema Mais Usado', value: sistemaMaisUsado, icon: Monitor, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-text-muted">{stat.label}</p>
                <p className="text-xl font-bold text-text-primary">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Online Users */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Quem está online agora
          </h3>
          <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            {activeSessions.length} ativo{activeSessions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loadingSessions ? (
          <LoadingSpinner label="Carregando sessões..." />
        ) : activeSessions.length === 0 ? (
          <div className="p-10 text-center text-text-muted">Nenhum usuário online no momento</div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {activeSessions.map((session) => (
              <div key={session.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-hover transition-colors">
                {/* Avatar */}
                <div className="relative">
                  {session.usuarioFotoPerfil ? (
                    <img src={session.usuarioFotoPerfil} alt="" className="h-10 w-10 rounded-full object-cover border border-border" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-sm font-bold text-gold">
                      {(session.usuarioNome || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1a1a1a] bg-emerald-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{session.usuarioNome}</p>
                  <p className="text-xs text-text-muted">{session.usuarioSetor} · {session.usuarioPerfil}</p>
                </div>

                {/* Device */}
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  {getDeviceIcon(session.userAgent)}
                  <span>{getBrowserName(session.userAgent)}</span>
                </div>

                {/* Last activity */}
                <div className="text-right">
                  <p className="text-xs text-text-secondary">{timeAgo(session.ultimaAtividade)}</p>
                  <p className="text-[10px] text-text-muted">desde {formatDateTime(session.inicio)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── Sessions History Tab ────────────────────────────────────────────────────
function SessionsTab() {
  const [filterUser, setFilterUser] = useState('')
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.usuarios.getAll(),
  })

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['sessions-historico', filterUser],
    queryFn: () => api.sessoes.getHistorico(filterUser ? { usuarioId: filterUser } : undefined),
  })

  const sessions = sessionsData?.content ?? []

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="appearance-none rounded-lg border border-border bg-card px-4 py-2 pr-8 text-sm text-text-primary focus:border-[#d4a843] focus:outline-none"
          >
            <option value="">Todos os usuários</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        {isLoading ? (
          <LoadingSpinner label="Carregando histórico..." />
        ) : sessions.length === 0 ? (
          <EmptyState title="Nenhuma sessão encontrada" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-sidebar text-xs uppercase text-text-muted">
              <tr>
                <th className="px-6 py-3 font-medium">Usuário</th>
                <th className="px-6 py-3 font-medium">Login</th>
                <th className="px-6 py-3 font-medium">Logout</th>
                <th className="px-6 py-3 font-medium">Duração</th>
                <th className="px-6 py-3 font-medium">Dispositivo</th>
                <th className="px-6 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {sessions.map((s) => {
                const duration = s.fim
                  ? Math.floor((new Date(s.fim).getTime() - new Date(s.inicio).getTime()) / 1000)
                  : null
                return (
                  <tr key={s.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 text-text-primary font-medium flex items-center gap-2">
                      {s.ativa && <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
                      {s.usuarioNome || 'Desconhecido'}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <LogIn className="h-3.5 w-3.5 text-emerald-400" />
                        {formatDateTime(s.inicio)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {s.fim ? (
                        <div className="flex items-center gap-1.5">
                          <LogOut className="h-3.5 w-3.5 text-red-400" />
                          {formatDateTime(s.fim)}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Ativo agora
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{s.ativa ? '—' : formatDuration(duration)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-text-secondary">
                        {getDeviceIcon(s.userAgent)}
                        {getBrowserName(s.userAgent)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-muted font-mono text-xs">{s.ipAddress || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  )
}

// ─── System Usage Tab ────────────────────────────────────────────────────────
function SystemsUsageTab() {
  const { data: resumo, isLoading } = useQuery({
    queryKey: ['tracking-resumo'],
    queryFn: () => api.tracking.getResumo(),
  })

  const ranking = resumo?.topSistemas ?? []
  const recentes = resumo?.acessosRecentes ?? []
  const maxAcessos = Math.max(...ranking.map((r) => r.totalAcessos), 1)

  return (
    <div className="space-y-6">
      {/* Ranking */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-6"
      >
        <h3 className="mb-4 text-sm font-medium text-text-primary flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" />
          Ranking de Sistemas Mais Acessados
        </h3>
        {isLoading ? (
          <LoadingSpinner label="Carregando..." />
        ) : ranking.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum dado de uso registrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {ranking.map((item, idx) => (
              <div key={item.sistemaId} className="flex items-center gap-4">
                <span className="w-6 text-right text-sm font-bold text-text-muted">#{idx + 1}</span>
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">{item.sistemaNome}</span>
                    <span className="text-xs text-text-secondary">
                      {item.totalAcessos} acesso{item.totalAcessos !== 1 ? 's' : ''} · {item.tempoTotalMinutos}min
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.totalAcessos / maxAcessos) * 100}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.1 }}
                      className="h-full rounded-full bg-gradient-to-r from-[#d4a843] to-[#e5bc55]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Recent accesses table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-sm font-medium text-text-primary">Acessos Recentes</h3>
        </div>
        {isLoading ? (
          <LoadingSpinner label="Carregando..." />
        ) : recentes.length === 0 ? (
          <EmptyState title="Nenhum acesso registrado" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-sidebar text-xs uppercase text-text-muted">
              <tr>
                <th className="px-6 py-3 font-medium">Usuário</th>
                <th className="px-6 py-3 font-medium">Sistema</th>
                <th className="px-6 py-3 font-medium">Início</th>
                <th className="px-6 py-3 font-medium">Duração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {recentes.map((r) => (
                <tr key={r.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-6 py-4 text-text-primary font-medium">{r.usuarioNome || '—'}</td>
                  <td className="px-6 py-4 text-text-secondary">{r.sistemaNome || '—'}</td>
                  <td className="px-6 py-4 text-text-secondary">{formatDateTime(r.inicio)}</td>
                  <td className="px-6 py-4 text-text-secondary">{formatDuration(r.duracaoSegundos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  )
}

// ─── Activity Logs Tab (Improved AuditLogViewer) ─────────────────────────────
function ActivityLogsTab() {
  const [filterAcao, setFilterAcao] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['auditoria', filterAcao],
    queryFn: () => api.auditoria.getAll(filterAcao ? { acao: filterAcao } : undefined),
  })

  const logs = auditData?.content ?? []

  const acoes = [
    'LOGIN_SUCCESS', 'LOGIN_DENIED', 'GRANT_ACCESS', 'REVOKE_ACCESS',
    'UPDATE_USER_ROLE', 'CREATE_CLIENTE', 'CREATE_TAREFA', 'UPDATE_TAREFA_STATUS',
  ]

  const ACAO_COLORS: Record<string, string> = {
    LOGIN_SUCCESS: 'bg-emerald-400/10 text-emerald-400',
    LOGIN_DENIED: 'bg-red-400/10 text-red-400',
    GRANT_ACCESS: 'bg-blue-400/10 text-blue-400',
    REVOKE_ACCESS: 'bg-orange-400/10 text-orange-400',
    UPDATE_USER_ROLE: 'bg-purple-400/10 text-purple-400',
    CREATE_CLIENTE: 'bg-cyan-400/10 text-cyan-400',
    CREATE_TAREFA: 'bg-gold/10 text-gold',
    UPDATE_TAREFA_STATUS: 'bg-pink-400/10 text-pink-400',
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={filterAcao}
            onChange={(e) => setFilterAcao(e.target.value)}
            className="appearance-none rounded-lg border border-border bg-card px-4 py-2 pr-8 text-sm text-text-primary focus:border-[#d4a843] focus:outline-none"
          >
            <option value="">Todas as ações</option>
            {acoes.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        {isLoading ? (
          <LoadingSpinner label="Carregando logs..." />
        ) : logs.length === 0 ? (
          <EmptyState title="Nenhum log encontrado" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-sidebar text-xs uppercase text-text-muted">
              <tr>
                <th className="px-6 py-3 font-medium">Data/Hora</th>
                <th className="px-6 py-3 font-medium">Usuário</th>
                <th className="px-6 py-3 font-medium">Ação</th>
                <th className="px-6 py-3 font-medium">Alvo</th>
                <th className="px-6 py-3 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-6 py-4 text-text-secondary whitespace-nowrap">{formatDateTime(log.dataHora)}</td>
                  <td className="px-6 py-4 text-text-primary font-medium">{log.usuarioNome || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ACAO_COLORS[log.acao] || 'bg-surface-hover text-text-secondary'}`}>
                      {log.acao.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{log.alvo || '—'}</td>
                  <td className="px-6 py-4">
                    {log.detalhes && Object.keys(log.detalhes).length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="text-xs text-gold hover:text-[#e5bc55]"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        {expandedId === log.id ? 'Fechar' : 'Ver'}
                      </Button>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Expanded Details Modal */}
      {expandedId && (() => {
        const log = logs.find((l) => l.id === expandedId)
        if (!log) return null
        return (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-sidebar p-4"
          >
            <p className="mb-2 text-xs font-medium text-gold">Detalhes do Log #{log.id}</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-background p-3 text-xs text-text-secondary">
              {JSON.stringify(log.detalhes, null, 2)}
            </pre>
          </motion.div>
        )
      })()}
    </div>
  )
}

// ─── Main Audit Page ─────────────────────────────────────────────────────────
export default function AuditPage() {
  const user = useAuthStore((s) => s.user)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  useEffect(() => {
    setCurrentPage('Auditoria')
  }, [setCurrentPage])

  if (user?.perfil !== 'ADMIN') {
    return <Navigate to="/" replace />
  }

  const [activeTab, setActiveTab] = useState<AuditTab>('overview')

  const tabs: { key: AuditTab; label: string; icon: typeof Activity }[] = [
    { key: 'overview', label: 'Visão Geral', icon: Activity },
    { key: 'sessions', label: 'Sessões', icon: Clock },
    { key: 'systems', label: 'Uso de Sistemas', icon: Monitor },
    { key: 'logs', label: 'Logs de Atividade', icon: Shield },
  ]

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Monitore quem está online, histórico de sessões, uso de sistemas e atividades do ecossistema."
      />

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-1 rounded-lg bg-card p-1 w-fit border border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-gold text-black'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'sessions' && <SessionsTab />}
        {activeTab === 'systems' && <SystemsUsageTab />}
        {activeTab === 'logs' && <ActivityLogsTab />}
      </motion.div>
    </div>
  )
}
