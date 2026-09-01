import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vpsApi, vpsQueryOptions } from '../lib/api'
import { fmtBytes, fmtPct } from '../lib/format'
import { MetricChart } from '../components/MetricChart'
import { ErrorMsg, Loading } from '../components/ui'

type Range = '24h' | '7d' | '30d'
const RANGES: { key: Range; label: string }[] = [
  { key: '24h', label: '24 horas' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
]

export default function Historico() {
  const [range, setRange] = useState<Range>('24h')
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['vps', 'metrics', range],
    queryFn: () => vpsApi.metrics(range),
    refetchInterval: 60_000,
    ...vpsQueryOptions,
  })

  const points = data?.points ?? []

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
      </div>
      <p className="vm-page-sub">
        Janela da própria API da Hostinger (amostragem em minutos). {isFetching && !isLoading ? 'Atualizando…' : ''}
      </p>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorMsg error={error} />
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
              {fmtPct(Math.max(...points.map((p) => p.ramPct ?? 0)))} · {points.length} amostras
            </p>
          )}
        </>
      )}
    </>
  )
}
