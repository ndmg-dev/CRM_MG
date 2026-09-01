import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { Cpu, HardDrive, MemoryStick, RefreshCw, Server, ShieldCheck } from 'lucide-react'
import { vpsApi, vpsQueryOptions } from '../lib/api'
import type { MetricPoint } from '../lib/types'
import { fmtBytes, fmtDateTime, fmtPct, fmtRelative, fmtUptime, stateLabel, stateTone } from '../lib/format'
import { Badge, Bar, Card, ErrorMsg, Loading, pctTone } from '../components/ui'

function Spark({ points, dataKey, color }: { points: MetricPoint[]; dataKey: keyof MetricPoint; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <Area type="monotone" dataKey={dataKey as string} stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.15} isAnimationActive={false} connectNulls dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function Overview() {
  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ['vps', 'overview'],
    queryFn: vpsApi.overview,
    refetchInterval: 60_000,
    ...vpsQueryOptions,
  })

  if (isLoading) return <Loading label="Consultando a VPS…" />
  if (error) return <ErrorMsg error={error} />
  if (!data) return null

  const { vm, latest, spark24h, snapshot, monarx } = data
  const ip = vm?.ipv4?.[0]?.address

  return (
    <>
      <div className="vm-toolbar">
        <h2 className="vm-page-title" style={{ marginRight: 'auto' }}>Visão Geral</h2>
        <button className="vm-btn" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? 'vm-inline-spin' : undefined} /> Atualizar
        </button>
      </div>
      <p className="vm-page-sub">
        {vm?.hostname ?? 'VPS'} {ip ? `· ${ip}` : ''} · {vm?.plan ?? '—'} · atualizado {fmtRelative(data.generatedAt)}
      </p>

      <div className="vm-grid" style={{ marginBottom: 14 }}>
        <Card title="Estado">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Server size={22} color="var(--vm-gold)" />
            <Badge tone={stateTone(vm?.state)}>{stateLabel(vm?.state)}</Badge>
          </div>
          <div className="vm-metric-label" style={{ marginTop: 10 }}>
            Uptime {fmtUptime(latest?.uptime)} · lock: {vm?.actions_lock ?? '—'}
          </div>
        </Card>

        <Card title="CPU">
          <div className="vm-metric-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={18} color="var(--vm-text-dim)" /> {fmtPct(latest?.cpu)}
          </div>
          <div className="vm-metric-label">{vm?.cpus ?? '—'} vCPU</div>
          <Bar pct={latest?.cpu} tone={pctTone(latest?.cpu)} />
          <Spark points={spark24h} dataKey="cpu" color="#d4a843" />
        </Card>

        <Card title="Memória">
          <div className="vm-metric-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MemoryStick size={18} color="var(--vm-text-dim)" /> {fmtPct(latest?.ramPct)}
          </div>
          <div className="vm-metric-label">
            {fmtBytes(latest?.ram)} / {fmtBytes(data.memBytes)}
          </div>
          <Bar pct={latest?.ramPct} tone={pctTone(latest?.ramPct)} />
          <Spark points={spark24h} dataKey="ramPct" color="#58a6ff" />
        </Card>

        <Card title="Disco">
          <div className="vm-metric-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HardDrive size={18} color="var(--vm-text-dim)" /> {fmtPct(latest?.diskPct)}
          </div>
          <div className="vm-metric-label">
            {fmtBytes(latest?.disk)} / {fmtBytes(data.diskBytes)}
          </div>
          <Bar pct={latest?.diskPct} tone={pctTone(latest?.diskPct)} />
          <Spark points={spark24h} dataKey="diskPct" color="#f0883e" />
        </Card>

        <Card title="Tráfego (último ponto 24h)">
          <div className="vm-kv">
            <dt>Entrada</dt>
            <dd>{fmtBytes(latest?.netIn)}</dd>
            <dt>Saída</dt>
            <dd>{fmtBytes(latest?.netOut)}</dd>
            <dt>Franquia/mês</dt>
            <dd>{fmtBytes(data.bandwidthBytes)}</dd>
          </div>
        </Card>

        <Card title="Proteção & Backup">
          <div className="vm-kv">
            <dt>Snapshot</dt>
            <dd>{snapshot.exists ? fmtRelative(snapshot.createdAt) : 'nenhum'}</dd>
            <dt>Backups</dt>
            <dd>{data.backupsCount} · último {fmtRelative(data.lastBackupAt)}</dd>
            <dt>Monarx</dt>
            <dd style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color={monarx && monarx.malicious > 0 ? 'var(--vm-bad)' : 'var(--vm-ok)'} />
              {monarx ? `${monarx.malicious} maliciosos / ${monarx.scanned_files} arquivos` : '—'}
            </dd>
          </div>
        </Card>
      </div>

      <Card title="Identificação">
        <dl className="vm-kv">
          <dt>Hostname</dt>
          <dd>{vm?.hostname ?? '—'}</dd>
          <dt>IPv4</dt>
          <dd>{vm?.ipv4?.map((i) => i.address).join(', ') || '—'}</dd>
          <dt>IPv6</dt>
          <dd>{vm?.ipv6?.map((i) => i.address).join(', ') || '—'}</dd>
          <dt>Template</dt>
          <dd>{vm?.template?.name ?? '—'}</dd>
          <dt>Nameservers</dt>
          <dd>{[vm?.ns1, vm?.ns2].filter(Boolean).join(', ') || '—'}</dd>
          <dt>Criada em</dt>
          <dd>{fmtDateTime(vm?.created_at)}</dd>
        </dl>
      </Card>
    </>
  )
}
