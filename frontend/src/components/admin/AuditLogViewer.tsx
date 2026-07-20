import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { formatDateTime } from '@/lib/utils'
import { Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AuditLogViewer() {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterAcao, setFilterAcao] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['auditoria', filterAcao],
    queryFn: () => api.auditoria.getAll(filterAcao ? { acao: filterAcao } : undefined),
  })

  const logs = data?.content || []

  if (isLoading) return <LoadingSpinner label="Carregando logs..." />

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Filter className="h-4 w-4 text-text-muted" />
        <select
          className="bg-transparent text-sm text-text-primary outline-none [&>option]:bg-card"
          value={filterAcao}
          onChange={(e) => setFilterAcao(e.target.value)}
        >
          <option value="">Todas as ações</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="LOGIN_DENIED">LOGIN_DENIED</option>
          <option value="GRANT_ACCESS">GRANT_ACCESS</option>
          <option value="REVOKE_ACCESS">REVOKE_ACCESS</option>
          <option value="UPDATE_USER_ROLE">UPDATE_USER_ROLE</option>
          <option value="CREATE_CLIENTE">CREATE_CLIENTE</option>
          <option value="CREATE_TAREFA">CREATE_TAREFA</option>
          <option value="UPDATE_TAREFA_STATUS">UPDATE_TAREFA_STATUS</option>
        </select>
      </div>

      {logs.length === 0 ? (
        <EmptyState title="Nenhum log encontrado" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-sidebar/50">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-text-muted">Data/Hora</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-text-muted">Usuário (Autor)</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-text-muted">Ação</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-text-muted">Alvo</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase text-text-muted">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr className="border-b border-border transition-colors hover:bg-surface">
                    <td className="px-5 py-3 text-sm text-text-secondary">{formatDateTime(log.dataHora)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-text-primary">{log.usuarioNome}</td>
                    <td className="px-5 py-3 text-sm text-gold">{log.acao}</td>
                    <td className="px-5 py-3 text-sm text-text-secondary">{log.alvo}</td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        {expandedId === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr className="bg-sidebar">
                      <td colSpan={5} className="p-0">
                        <div className="border-b border-border p-4">
                          <pre className="overflow-x-auto rounded bg-background p-4 text-xs text-text-secondary">
                            {JSON.stringify(log.detalhes, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Fix missing React import for Fragment
import React from 'react'
