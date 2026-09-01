import { useQuery } from '@tanstack/react-query'
import { vpsApi } from '../lib/api'
import { fmtBytes, fmtDateTime, fmtRelative } from '../lib/format'
import { Badge, Card, Empty, ErrorMsg, Loading } from '../components/ui'

function restoreLabel(seconds: number): string {
  const min = Math.round(seconds / 60)
  return min >= 60 ? `~${Math.round(min / 60)} h` : `~${min} min`
}

export default function SnapshotsBackups() {
  const snapQ = useQuery({ queryKey: ['vps', 'snapshot'], queryFn: vpsApi.snapshot })
  const bkpQ = useQuery({ queryKey: ['vps', 'backups'], queryFn: vpsApi.backups })

  if (snapQ.isLoading || bkpQ.isLoading) return <Loading />
  if (bkpQ.error) return <ErrorMsg error={bkpQ.error} />

  const snap = snapQ.data
  const backups = bkpQ.data?.data ?? []

  return (
    <>
      <h2 className="vm-page-title">Snapshots &amp; Backups</h2>
      <p className="vm-page-sub">Somente leitura. Criar/restaurar entra na Fase 4 (admin-only + confirmação digitada).</p>

      <div className="vm-note">
        A Hostinger permite <strong>apenas 1 snapshot manual</strong> por VPS — criar um novo substitui o anterior.
        Backups automáticos são independentes e mantêm histórico próprio.
      </div>

      <div className="vm-grid" style={{ marginBottom: 14 }}>
        <Card title="Snapshot manual">
          {snap?.exists ? (
            <dl className="vm-kv">
              <dt>Criado</dt>
              <dd>{fmtDateTime(snap.createdAt)} ({fmtRelative(snap.createdAt)})</dd>
              <dt>Expira</dt>
              <dd>{fmtDateTime(snap.expiresAt)}</dd>
              <dt>Tempo de restauração</dt>
              <dd>{snap.restoreTime ? restoreLabel(snap.restoreTime) : '—'}</dd>
            </dl>
          ) : (
            <Badge tone="neutral">Nenhum snapshot manual</Badge>
          )}
        </Card>
      </div>

      <Card title={`Backups automáticos (${backups.length})`} className="vm-chart-card">
        {backups.length === 0 ? (
          <Empty>Nenhum backup automático disponível.</Empty>
        ) : (
          <table className="vm-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Idade</th>
                <th>Tamanho</th>
                <th>Restauração</th>
                <th>Local</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>{fmtDateTime(b.created_at)}</td>
                  <td>{fmtRelative(b.created_at)}</td>
                  <td>{fmtBytes(b.size)}</td>
                  <td>{restoreLabel(b.restore_time)}</td>
                  <td>{b.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
