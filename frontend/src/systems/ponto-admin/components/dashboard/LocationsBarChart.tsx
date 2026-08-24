import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from 'recharts'
import type { TimeLog } from '../../hooks/useTimeLogs'
import { locationKey } from '../../utils/location'

interface BarLabelProps {
  x?: number
  y?: number
  width?: number
  value?: number
}

/**
 * Rótulo de dados no topo da coluna. Fica sempre fora do fill (nunca sobre o
 * dourado) e em cor de texto, não na cor da série — a legibilidade não pode
 * depender da altura da coluna.
 */
function ColumnValueLabel({ x = 0, y = 0, width = 0, value }: BarLabelProps) {
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      className="bar-value-label"
      textAnchor="middle"
    >
      {value}
    </text>
  )
}

interface TooltipPayload {
  payload?: { local: string; total: number }
}

/** O eixo não tem rótulo de categoria: o endereço é revelado aqui. */
function LocationTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  const row = active ? payload?.[0]?.payload : undefined
  if (!row) return null
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{row.local}</div>
      <div className="chart-tip-value">
        {row.total} <span>batida{row.total === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

interface LocationsBarChartProps {
  logs: Pick<TimeLog, 'address' | 'latitude' | 'longitude'>[]
}

export default function LocationsBarChart({ logs }: LocationsBarChartProps) {
  const counts = new Map<string, number>()
  for (const log of logs) {
    const key = locationKey(log)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const data = Array.from(counts.entries())
    .map(([local, total]) => ({ local, total }))
    .sort((a, b) => b.total - a.total)

  if (!data.length) {
    return <div className="chart-empty">Nenhum ponto neste dia.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      {/* margin.top reserva a faixa do rótulo acima da coluna mais alta, que
          encosta no topo da área de plotagem. */}
      <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="dashboardLocationsBar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--gold-2, #C9960C)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--gold, #C9960C)' }} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        {/* Sem tick de categoria: os endereços são longos e ilegíveis girados
            sob colunas estreitas — quem é cada coluna sai na tooltip. */}
        <XAxis dataKey="local" tick={false} axisLine={false} tickLine={false} height={8} />
        <YAxis
          type="number"
          allowDecimals={false}
          width={32}
          tick={{ fontSize: 10, fill: 'var(--mg-muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<LocationTooltip />} />
        <Bar dataKey="total" fill="url(#dashboardLocationsBar)" radius={[4, 4, 0, 0]} maxBarSize={56}>
          <LabelList dataKey="total" content={<ColumnValueLabel />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
