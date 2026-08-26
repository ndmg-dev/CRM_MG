import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 4, fontSize: 12 }}>Semana de {label}</p>
      <p style={{ fontWeight: 700, color: 'var(--color-accent-gold)', fontSize: 14 }}>
        {payload[0].value} ticket{payload[0].value !== 1 ? 's' : ''} concluído{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export default function ThroughputChart({ data }: { data: any[] }) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 className="text-gold-gradient" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'inline-block' }}>
        Throughput Semanal
      </h3>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        Tickets concluídos por semana (últimas 12 semanas)
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,168,83,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212,168,83,0.04)' }} />
          <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={32}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.count > 0 ? 'url(#taskflowGoldGradientBar)' : 'rgba(42,42,69,0.3)'}
              />
            ))}
          </Bar>
          <defs>
            <linearGradient id="taskflowGoldGradientBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8c97a" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#b8942f" stopOpacity={0.7} />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
