import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CompositionChartProps {
  data: any[];
}

const COLORS = ['#d4af37', '#e4e4e7', '#a1a1aa', '#71717a', '#f43f5e', '#3b82f6'];

export default function CompositionChart({ data }: CompositionChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-[#111111] border border-[#27272a] rounded-xl p-6 shadow-xl h-full flex flex-col">
      <h3 className="text-white text-lg font-bold mb-4">Composição de Deduções vs CPV</h3>
      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                return percent > 0.05 ? (
                  <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                    {`${(percent * 100).toFixed(0)}%`}
                  </text>
                ) : null;
              }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1c', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
              formatter={(value: number, name: string) => [
                `R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
                name
              ]}
              itemStyle={{ color: '#d4af37', fontWeight: 'bold' }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              formatter={(value) => <span style={{ color: '#e4e4e7' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
