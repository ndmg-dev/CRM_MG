import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vpsApi, vpsQueryOptions } from '../lib/api'
import { fmtBytes, fmtPct, type ChartRange } from '../lib/format'
import { MetricChart } from '../components/MetricChart'
import { ErrorMsg, Empty, Freshness, Loading } from '../components/ui'

const RANGES: { key: ChartRange; label: string; source: 'hostinger' | 'history' }[] = [
  { key: '24h', label: '24 horas', source: 'hostinger' },
  { key: '7d', label: '7 dias', source: 'hostinger' },
  { key: '30d', label: '30 dias', source: 'hostinger' },
  { key: '90d', label: '90 dias', source: 'history' },
  { key: '1y', label: '1 ano', source: 'history' },
]

export default function Historico() {
  const [range, setRange] = useState<ChartRange>('24h')
  const source = RANGES.find((r) => r.key === range)!.source

  const { data, isLoading, error, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['vps', source, range],
    queryFn: async () => {
      const res =
        source === 'hostinger'
          ? await vpsApi.metrics(range as '24h' | '7d' | '30d')
          : await vpsApi.history(range as '90d' | '1y')
      const sampleCount = 'sampleCount' in res ? res.sampleCount : res.points.length
      return { points: res.points, sampleCount }
    },
    refetchInterval: 60_000,
    ...vpsQueryOptions,
  })

  const points = data?.points ?? []
  const sampleCount = data?.sampleCount ?? 0

  return (
    <>
      <div className="vm-toolbar">
        <h2 className="vm-page-title" style={{ marginRight: 'auto' }}>Histórico</h2>
        <div className="vm-seg">
          {RANGES.map((r) => (
            <button key={r.key} className={r.key === range ? 'active' : ''} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        <Freshness updatedAt={dataUpdatedAt} fetching={isFetching && !isLoading} />
      </div>
      <p className="vm-page-sub">
        {source === 'hostinger'
          ? 'Janela da própria API da Hostinger (amostragem em minutos).'
          : 'Histórico da nossa tabela — alimentado pelo poller (Fase 3).'}
      </p>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorMsg error={error} />
      ) : source === 'history' && points.length === 0 ? (
        <Empty>
          O poller ainda não acumulou {range === '90d' ? '90 dias' : '1 ano'} de dados.
          As janelas de 24h/7d/30d vêm direto da Hostinger e já funcionam.
        </Empty>
      ) : (
        <>
          <MetricChart title="CPU (%)" points={points} range={range} dataKey="cpu" color="#d4a843" format={(v) => v.toFixed(0)} unit="%" />
          <MetricChart title="Memória (%)" points={points} range={range} dataKey="ramPct" color="#58a6ff" format={(v) => v.toFixed(0)} unit="%" />
          <MetricChart title="Disco usado (%)" points={points} range={range} dataKey="diskPct" color="#f0883e" format={(v) => v.toFixed(0)} unit="%" />
          <MetricChart title="Tráfego de entrada" points={points} range={range} dataKey="netIn" color="#3fb950" format={(v) => fmtBytes(v, 0)} />
          <MetricChart title="Tráfego de saída" points={points} range={range} dataKey="netOut" color="#f85149" format={(v) => fmtBytes(v, 0)} />
          {points.length > 0 && (
            <p className="vm-page-sub">
              Pico de CPU: {fmtPct(Math.max(...points.map((p) => p.cpu ?? 0)))} · pico de RAM:{' '}
              {fmtPct(Math.max(...points.map((p) => p.ramPct ?? 0)))} · {sampleCount} amostras
            </p>
          )}
        </>
      )}
    </>
  )
}
