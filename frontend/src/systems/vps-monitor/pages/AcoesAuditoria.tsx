import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { vpsApi, vpsQueryOptions } from '../lib/api'
import { actionLabel, fmtDateTime, fmtRelative, isNoiseAction } from '../lib/format'
import type { ActionCatalogItem } from '../lib/types'
import { Badge, Card, Empty, ErrorMsg, Freshness, Loading } from '../components/ui'
import { ActionModal } from '../components/ActionModal'

function stateTone(s: string): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (s === 'success') return 'ok'
  if (s === 'error' || s === 'failed') return 'bad'
  if (s === 'in_progress' || s === 'pending') return 'warn'
  return 'neutral'
}

// As que não dependem de escolher um backup ficam aqui; restore-backup fica na
// tela Snapshots & Backups, por backup.
const PAGE_ACTIONS = ['restart', 'recreate', 'recovery-enter', 'recovery-exit', 'restore-snapshot']

function DangerZone() {
  const [open, setOpen] = useState<ActionCatalogItem | null>(null)
  const { data } = useQuery({ queryKey: ['vps', 'action-catalog'], queryFn: vpsApi.actionCatalog, retry: false })

  const actions = (data?.actions ?? []).filter((a) => PAGE_ACTIONS.includes(a.key))
  if (actions.length === 0) return null

  return (
    <div className="vm-danger-zone">
      <h3>
        <ShieldAlert size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
        Ações da VPS — admin, confirmação digitada
      </h3>
      <p className="vm-metric-label" style={{ margin: '2px 0 8px' }}>
        Cada uma reinicia o servidor inteiro. CRM e satélites ficam fora ~1–2 min. Toda tentativa vai pro audit_log.
      </p>
      {actions.map((a) => (
        <div className="row" key={a.key}>
          <div className="meta">
            <div className="t">{a.label}</div>
            <div className="d">{a.descricao}</div>
          </div>
          <button className="vm-btn danger" onClick={() => setOpen(a)}>Executar…</button>
        </div>
      ))}
      {open && <ActionModal action={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

export default function AcoesAuditoria() {
  const isAdmin = useAuthStore((s) => s.user?.perfil === 'ADMIN')
  const [page, setPage] = useState(1)
  const [hideNoise, setHideNoise] = useState(true)
  const { data, isLoading, error, isFetching, dataUpdatedAt } = useQuery({
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
        <Freshness updatedAt={dataUpdatedAt} fetching={isFetching && !isLoading} />
      </div>
      <p className="vm-page-sub">
        Trilha de auditoria da própria Hostinger (quem/quando reiniciou, backups, etc.).
      </p>

      {isAdmin && <DangerZone />}

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
