import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MetricPoint } from '../lib/types'
import { tickLabel } from '../lib/format'

interface Props {
  title: string
  points: MetricPoint[]
  range: '24h' | '7d' | '30d'
  dataKey: keyof MetricPoint
  color?: string
  unit?: string
  format: (v: number) => string
  height?: number
}

// Gráfico de área padrão do painel. recharts@2 (o do CRM — não subir versão).
export function MetricChart({ title, points, range, dataKey, color = '#d4a843', unit, format, height = 220 }: Props) {
  return (
    <div className="vm-chart-card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id={`grad-${String(dataKey)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2a2a34" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t) => tickLabel(t, range)}
            stroke="#9a9aa6"
            fontSize={11}
            minTickGap={40}
          />
          <YAxis
            stroke="#9a9aa6"
            fontSize={11}
            width={56}
            tickFormatter={(v) => format(v)}
          />
          <Tooltip
            contentStyle={{ background: '#16161d', border: '1px solid #2a2a34', borderRadius: 8, fontSize: 12 }}
            labelFormatter={(t) => new Date(t as number).toLocaleString('pt-BR')}
            formatter={(v: number) => [`${format(v)}${unit ? ` ${unit}` : ''}`, title]}
          />
          <Area
            type="monotone"
            dataKey={dataKey as string}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${String(dataKey)})`}
            connectNulls
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
