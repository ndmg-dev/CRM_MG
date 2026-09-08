import { useQuery } from '@tanstack/react-query'
import { Boxes, GitBranch, Loader2, RefreshCw } from 'lucide-react'
import { vpsApi, vpsQueryOptions } from '../lib/api'
import { fmtBytes, fmtPct, fmtRelative } from '../lib/format'
import { Badge, Card, Empty, ErrorMsg, Freshness, Loading } from '../components/ui'

const CPU_COLOR: Record<string, string> = {
  neutral: 'var(--vm-text-dim)',
  ok: 'var(--vm-ok)',
  warn: 'var(--vm-warn)',
  bad: 'var(--vm-bad)',
}

function cpuColor(pct: number | null): string {
  if (pct == null) return CPU_COLOR.neutral
  if (pct >= 80) return CPU_COLOR.bad
  if (pct >= 40) return CPU_COLOR.warn
  return CPU_COLOR.ok
}

export default function Containers() {
  const q = useQuery({
    queryKey: ['vps', 'containers'],
    queryFn: vpsApi.containers,
    refetchInterval: 60_000,
    ...vpsQueryOptions,
  })
  const deployQ = useQuery({
    queryKey: ['vps', 'deploys'],
    queryFn: vpsApi.deploys,
    refetchInterval: 60_000,
    retry: false,
    staleTime: 30_000,
  })

  if (q.isLoading) return <Loading label="Lendo os coletores…" />
  if (q.error) return <ErrorMsg error={q.error} />
  if (!q.data) return null

  const { containers, counts, hasCpuRates } = q.data
  const running = deployQ.data?.running ?? []

  return (
    <>
      <div className="vm-toolbar">
        <h2 className="vm-page-title">Containers &amp; Deploys</h2>
        <Badge tone="ok">{counts.running} rodando</Badge>
        {counts.stopped > 0 && <Badge tone="neutral">{counts.stopped} parados</Badge>}
        {counts.unhealthy > 0 && <Badge tone="bad">{counts.unhealthy} unhealthy</Badge>}
        <button className="vm-btn" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw size={14} className={q.isFetching ? 'vm-inline-spin' : undefined} /> Atualizar
        </button>
        <Freshness updatedAt={q.dataUpdatedAt} fetching={q.isFetching && !q.isLoading} />
      </div>

      {!hasCpuRates && (
        <div className="vm-note">
          Primeira leitura — o % de CPU por container é derivado entre dois scrapes e aparece no próximo refresh (~60s).
        </div>
      )}

      {running.length > 0 && (
        <Card title="Deploys em andamento" className="vm-chart-card">
          {running.map((d) => (
            <div key={d.uuid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <Loader2 size={14} className="vm-inline-spin" />
              <strong>{d.application ?? '—'}</strong>
              <span className="vm-metric-label">
                {d.commit ? `${d.commit} · ` : ''}{d.status} · iniciado {fmtRelative(d.createdAt)}
              </span>
            </div>
          ))}
        </Card>
      )}
      {deployQ.error && (
        <div className="vm-note">Coolify indisponível ({(deployQ.error as Error).message}) — a lista de containers abaixo não depende dele.</div>
      )}

      <Card title={`Containers (${counts.total})`} className="vm-chart-card">
        {containers.length === 0 ? (
          <Empty>Nenhum container reportado pelo cadvisor.</Empty>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="vm-table">
              <thead>
                <tr>
                  <th>Container</th>
                  <th>Projeto / serviço</th>
                  <th>CPU</th>
                  <th>Memória</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Boxes size={13} color="var(--vm-text-dim)" />
                        <span title={c.image ?? undefined}>{c.name}</span>
                      </div>
                    </td>
                    <td>
                      {c.project ? (
                        <span>
                          {c.project}
                          {c.service && <span className="vm-metric-label"> · {c.service}</span>}
                        </span>
                      ) : (
                        <span className="vm-metric-label">—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: cpuColor(c.cpuPct), fontWeight: 600 }}>{fmtPct(c.cpuPct)}</span>
                    </td>
                    <td>
                      {fmtBytes(c.memBytes)}
                      {c.memPct != null && (
                        <span className="vm-metric-label"> ({fmtPct(c.memPct)}{c.memLimitBytes ? ` de ${fmtBytes(c.memLimitBytes)}` : ''})</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={c.state === 'running' ? (c.status?.includes('unhealthy') ? 'warn' : 'ok') : 'bad'}>
                        {c.status ?? c.state ?? '—'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {deployQ.data && deployQ.data.applications.length > 0 && (
        <Card title={`Aplicações no Coolify (${deployQ.data.counts.applications})`} className="vm-chart-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="vm-table">
              <thead>
                <tr><th>Aplicação</th><th>Status</th><th>Branch</th><th>Online</th></tr>
              </thead>
              <tbody>
                {deployQ.data.applications.map((a) => (
                  <tr key={a.uuid}>
                    <td>{a.name}</td>
                    <td><Badge tone={a.status === 'running' ? 'ok' : 'bad'}>{a.status ?? '—'}</Badge></td>
                    <td>
                      {a.gitBranch && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <GitBranch size={12} color="var(--vm-text-dim)" />{a.gitBranch}
                        </span>
                      )}
                    </td>
                    <td className="vm-metric-label">{fmtRelative(a.lastOnlineAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
