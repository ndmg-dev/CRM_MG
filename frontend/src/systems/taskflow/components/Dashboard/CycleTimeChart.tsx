import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p style={{ fontWeight: 700, color: 'var(--color-accent-gold)', fontSize: 14 }}>
        {payload[0].value}h
      </p>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
        ({(payload[0].value / 24).toFixed(1)} dias)
      </p>
    </div>
  )
}

export default function CycleTimeChart({ data }: { data: any[] }) {
  const chartData = data.map((d, i) => ({
    index: i + 1,
    hours: d.hours,
  }))

  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 className="text-gold-gradient" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'inline-block' }}>
        Cycle Time por Ticket
      </h3>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        Tempo de In Progress até Done (últimos 20 tickets)
      </p>

      {chartData.length === 0 ? (
        <div
          style={{
            height: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 13,
          }}
        >
          Sem dados suficientes
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="taskflowCycleGradientArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4a853" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#d4a853" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,168,83,0.06)" vertical={false} />
            <XAxis
              dataKey="index"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              label={{ value: 'Tickets', position: 'insideBottom', offset: -5, fill: 'var(--color-text-muted)', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              label={{ value: 'Horas', angle: -90, position: 'insideLeft', offset: 20, fill: 'var(--color-text-muted)', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="hours"
              stroke="rgba(212,168,83,0.7)"
              strokeWidth={2}
              fill="url(#taskflowCycleGradientArea)"
              dot={{ fill: '#d4a853', r: 3, strokeWidth: 0 }}
              activeDot={{ fill: '#e8c97a', r: 5, strokeWidth: 2, stroke: 'rgba(5,5,8,0.8)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
