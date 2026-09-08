import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Archive, Box, Database, HardDrive, Hammer } from 'lucide-react'
import { vpsApi, vpsQueryOptions } from '../lib/api'
import { fmtBytes, fmtPct } from '../lib/format'
import { Bar, Card, ErrorMsg, Freshness, Loading, pctTone } from '../components/ui'

function Row({
  icon,
  label,
  bucket,
  hint,
}: {
  icon: ReactNode
  label: string
  bucket: { count: number; sizeBytes: number; reclaimableBytes?: number; dangling?: number }
  hint?: string
}) {
  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon} {label}
        </div>
      </td>
      <td>{bucket.count}</td>
      <td>{fmtBytes(bucket.sizeBytes)}</td>
      <td>
        {bucket.reclaimableBytes != null && bucket.reclaimableBytes > 0 ? (
          <span style={{ color: 'var(--vm-warn)' }}>{fmtBytes(bucket.reclaimableBytes)}</span>
        ) : (
          <span className="vm-metric-label">—</span>
        )}
        {hint && <span className="vm-metric-label"> · {hint}</span>}
      </td>
    </tr>
  )
}

export default function Disco() {
  const { data, isLoading, error, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['vps', 'disk'],
    queryFn: vpsApi.disk,
    refetchInterval: 90_000,
    ...vpsQueryOptions,
  })

  if (isLoading) return <Loading label="Lendo o disco…" />
  if (error) return <ErrorMsg error={error} />
  if (!data) return null

  const { filesystem: fs, docker } = data

  return (
    <>
      <div className="vm-toolbar">
        <h2 className="vm-page-title">Disco</h2>
        <Freshness updatedAt={dataUpdatedAt} fetching={isFetching && !isLoading} />
      </div>

      <div className="vm-grid" style={{ marginBottom: 14 }}>
        <Card title="Sistema de arquivos (/)">
          <div className="vm-metric-value">{fmtPct(fs.pct)}</div>
          <div className="vm-metric-label">
            {fmtBytes(fs.usedBytes)} de {fmtBytes(fs.totalBytes)} · livre {fmtBytes(fs.availBytes)}
          </div>
          <Bar pct={fs.pct} tone={pctTone(fs.pct)} />
        </Card>

        <Card title="Docker — total">
          <div className="vm-metric-value">{fmtBytes(docker.totalBytes)}</div>
          <div className="vm-metric-label">imagens + containers + volumes + build cache</div>
        </Card>

        <Card title="Recuperável (prune)">
          <div className="vm-metric-value" style={{ color: docker.reclaimableBytes > 0 ? 'var(--vm-warn)' : undefined }}>
            {fmtBytes(docker.reclaimableBytes)}
          </div>
          <div className="vm-metric-label">imagens sem uso + volumes órfãos + todo o build cache</div>
        </Card>
      </div>

      <Card title="Detalhamento do Docker" className="vm-chart-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="vm-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Itens</th>
                <th>Tamanho</th>
                <th>Recuperável</th>
              </tr>
            </thead>
            <tbody>
              <Row
                icon={<Archive size={14} color="var(--vm-text-dim)" />}
                label="Imagens"
                bucket={docker.images}
                hint={docker.images.dangling ? `${docker.images.dangling} dangling` : undefined}
              />
              <Row icon={<Box size={14} color="var(--vm-text-dim)" />} label="Containers (camada gravável)" bucket={docker.containers} />
              <Row icon={<Database size={14} color="var(--vm-text-dim)" />} label="Volumes" bucket={docker.volumes} />
              <Row icon={<Hammer size={14} color="var(--vm-text-dim)" />} label="Build cache" bucket={docker.buildCache} />
            </tbody>
          </table>
        </div>
      </Card>

      <div className="vm-note">
        <HardDrive size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
        O disco oscilou muito (68 → 96 → 74 GB em 7 dias no diagnóstico) — quase todo build cache do Coolify.
        O botão de <strong>prune</strong> entra na Fase 4 (admin-only + confirmação).
      </div>
    </>
  )
}
