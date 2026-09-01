import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { vpsApi, vpsQueryOptions } from '../lib/api'
import { actionLabel, fmtDateTime, fmtRelative, isNoiseAction } from '../lib/format'
import { Badge, Card, Empty, ErrorMsg, Loading } from '../components/ui'

function stateTone(s: string): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (s === 'success') return 'ok'
  if (s === 'error' || s === 'failed') return 'bad'
  if (s === 'in_progress' || s === 'pending') return 'warn'
  return 'neutral'
}

export default function AcoesAuditoria() {
  const [page, setPage] = useState(1)
  const [hideNoise, setHideNoise] = useState(true)
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['vps', 'actions', page],
    queryFn: () => vpsApi.actions(page),
    placeholderData: keepPreviousData,
    ...vpsQueryOptions,
  })

  if (isLoading) return <Loading />
  if (error) return <ErrorMsg error={error} />

  const all = data?.data ?? []
  const rows = hideNoise ? all.filter((a) => !isNoiseAction(a.name)) : all

  return (
    <>
      <div className="vm-toolbar">
        <h2 className="vm-page-title" style={{ marginRight: 'auto' }}>Ações &amp; Auditoria</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--vm-text-dim)' }}>
          <input type="checkbox" checked={hideNoise} onChange={(e) => setHideNoise(e.target.checked)} />
          Ocultar ajustes automáticos
        </label>
      </div>
      <p className="vm-page-sub">
        Trilha de auditoria da própria Hostinger (quem/quando reiniciou, backups, etc.). O histórico de ações
        disparadas pelo CRM entra na Fase 4.
      </p>

      <Card title={`Histórico de ações · página ${page}`} className="vm-chart-card">
        {rows.length === 0 ? (
          <Empty>Nenhuma ação nesta página{hideNoise ? ' (fora os ajustes automáticos)' : ''}.</Empty>
        ) : (
          <table className="vm-table">
            <thead>
              <tr>
                <th>Ação</th>
                <th>Estado</th>
                <th>Iniciada</th>
                <th>Concluída</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{actionLabel(a.name)}</td>
                  <td><Badge tone={stateTone(a.state)}>{a.state}</Badge></td>
                  <td>{fmtDateTime(a.created_at)}</td>
                  <td>{fmtDateTime(a.updated_at)}</td>
                  <td>{fmtRelative(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button className="vm-btn" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <button className="vm-btn" disabled={all.length === 0 || isFetching} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </button>
          {isFetching && <span className="vm-metric-label">carregando…</span>}
        </div>
      </Card>
    </>
  )
}
