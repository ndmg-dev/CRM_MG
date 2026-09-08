import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { vpsApi, vpsQueryOptions } from '../lib/api'
import { fmtBytes, fmtDateTime, fmtRelative } from '../lib/format'
import type { ActionCatalogItem } from '../lib/types'
import { Badge, Card, Empty, ErrorMsg, Freshness, Loading } from '../components/ui'
import { ActionModal } from '../components/ActionModal'

function restoreLabel(seconds: number): string {
  const min = Math.round(seconds / 60)
  return min >= 60 ? `~${Math.round(min / 60)} h` : `~${min} min`
}

export default function SnapshotsBackups() {
  const isAdmin = useAuthStore((s) => s.user?.perfil === 'ADMIN')
  const snapQ = useQuery({ queryKey: ['vps', 'snapshot'], queryFn: vpsApi.snapshot, ...vpsQueryOptions })
  const bkpQ = useQuery({ queryKey: ['vps', 'backups'], queryFn: vpsApi.backups, ...vpsQueryOptions })
  const catalogQ = useQuery({
    queryKey: ['vps', 'action-catalog'],
    queryFn: vpsApi.actionCatalog,
    retry: false,
    enabled: isAdmin,
  })

  const [modal, setModal] = useState<{ action: ActionCatalogItem; backupId?: number } | null>(null)

  if (snapQ.isLoading || bkpQ.isLoading) return <Loading />
  if (bkpQ.error) return <ErrorMsg error={bkpQ.error} />

  const snap = snapQ.data
  const backups = bkpQ.data?.data ?? []
  const catalog = catalogQ.data?.actions ?? []
  const restoreSnapAction = catalog.find((a) => a.key === 'restore-snapshot')
  const restoreBackupAction = catalog.find((a) => a.key === 'restore-backup')

  return (
    <>
      <div className="vm-toolbar">
        <h2 className="vm-page-title">Snapshots &amp; Backups</h2>
        <Freshness updatedAt={bkpQ.dataUpdatedAt} fetching={snapQ.isFetching || bkpQ.isFetching} />
      </div>
      <p className="vm-page-sub">
        Restaurar volta o disco INTEIRO para aquele ponto — tudo depois dele é perdido.
        {isAdmin ? ' Só admin, com confirmação digitada.' : ' (ações de restauração: só admin)'}
      </p>

      <div className="vm-note">
        A Hostinger permite <strong>apenas 1 snapshot manual</strong> por VPS. Criar/apagar snapshot ainda não
        está no painel (próxima leva da Fase 4) — por ora, pelo hPanel.
      </div>

      <div className="vm-grid" style={{ marginBottom: 14 }}>
        <Card title="Snapshot manual">
          {snap?.exists ? (
            <>
              <dl className="vm-kv">
                <dt>Criado</dt>
                <dd>{fmtDateTime(snap.createdAt)} ({fmtRelative(snap.createdAt)})</dd>
                <dt>Expira</dt>
                <dd>{fmtDateTime(snap.expiresAt)}</dd>
                <dt>Tempo de restauração</dt>
                <dd>{snap.restoreTime ? restoreLabel(snap.restoreTime) : '—'}</dd>
              </dl>
              {isAdmin && restoreSnapAction && (
                <button
                  className="vm-btn danger"
                  style={{ marginTop: 12 }}
                  onClick={() => setModal({ action: restoreSnapAction })}
                >
                  Restaurar snapshot…
                </button>
              )}
            </>
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
                {isAdmin && restoreBackupAction && <th />}
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
                  {isAdmin && restoreBackupAction && (
                    <td>
                      <button
                        className="vm-btn danger"
                        onClick={() => setModal({ action: restoreBackupAction, backupId: b.id })}
                      >
                        Restaurar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modal && <ActionModal action={modal.action} backupId={modal.backupId} onClose={() => setModal(null)} />}
    </>
  )
}
