import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface EvolutionChartProps {
  data: any[];
}

export default function EvolutionChart({ data }: EvolutionChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  if (!data || data.length === 0) return null;

  const getLabelName = (name: string) => {
    if (name === 'Receita') return 'Receita Líquida';
    if (name === 'Custos') return 'Regimes / Custos';
    if (name === 'Lucro') return 'Lucro Líquido';
    return name;
  };

  const CustomActiveDot = (props: any) => {
    const { cx, cy, stroke, dataKey } = props;
    const isHovered = hoveredKey === dataKey;

    return (
      <g
        onMouseEnter={() => setHoveredKey(dataKey)}
        onMouseLeave={() => setHoveredKey(null)}
        style={{ cursor: 'pointer' }}
      >
        {/* Invisible hit area to make it easier to hover */}
        <circle cx={cx} cy={cy} r={16} fill="transparent" />
        {/* Actual dot */}
        <circle
          cx={cx}
          cy={cy}
          r={isHovered ? 8 : 4}
          fill={isHovered ? stroke : '#111'}
          stroke={stroke}
          strokeWidth={isHovered ? 0 : 2}
          style={{ transition: 'all 0.2s ease-in-out' }}
        />
      </g>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length && hoveredKey) {
      const activePayload = payload.find((p: any) => p.dataKey === hoveredKey);

      if (!activePayload) return null;

      const isMargin = activePayload.name.includes('Margem');
      const val = activePayload.value;
      const formattedValue = isMargin
        ? `${val.toFixed(2)}%`
        : `R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

      return (
        <div style={{ backgroundColor: '#1a1a1c', border: '1px solid #27272a', borderRadius: '8px', padding: '10px', color: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}>
          <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '8px', margin: 0 }}>{label}</p>
          <p style={{ margin: 0, color: activePayload.color }}>
            {getLabelName(activePayload.name)}: <span style={{ fontWeight: 'bold' }}>{formattedValue}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#111111] border border-[#27272a] rounded-xl p-6 shadow-xl h-full flex flex-col">
      <h3 className="text-white text-lg font-bold mb-4">Evolução de Margens e Resultados</h3>
      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} onMouseLeave={() => setHoveredKey(null)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="period" stroke="#71717a" tick={{fill: '#71717a'}} axisLine={false} tickLine={false} />
            <YAxis
               yAxisId="left"
               stroke="#71717a"
               tick={{fill: '#71717a'}}
               axisLine={false}
               tickLine={false}
               tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`}
            />
            <YAxis
               yAxisId="right"
               orientation="right"
               stroke="#71717a"
               tick={{fill: '#71717a'}}
               axisLine={false}
               tickLine={false}
               tickFormatter={(val) => `${val}%`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={false}
              isAnimationActive={false}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />

            <Line yAxisId="left" type="monotone" dataKey="receita" stroke="#e4e4e7" strokeWidth={3} dot={{r: 4, fill: '#e4e4e7', strokeWidth: 0}} activeDot={<CustomActiveDot />} name="Receita" />
            <Line yAxisId="left" type="monotone" dataKey="custos" stroke="#f43f5e" strokeWidth={3} dot={{r: 4, fill: '#f43f5e', strokeWidth: 0}} activeDot={<CustomActiveDot />} name="Custos" />
            <Line yAxisId="left" type="monotone" dataKey="lucro_liquido" stroke="#d4af37" strokeWidth={4} dot={{r: 5, fill: '#111', stroke: '#d4af37', strokeWidth: 2}} activeDot={<CustomActiveDot />} name="Lucro" />
            <Line yAxisId="right" type="monotone" dataKey="margem_bruta" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{r: 4, fill: '#3b82f6', strokeWidth: 0}} activeDot={<CustomActiveDot />} name="Margem Bruta %" />
            <Line yAxisId="right" type="monotone" dataKey="margem_liquida" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{r: 4, fill: '#8b5cf6', strokeWidth: 0}} activeDot={<CustomActiveDot />} name="Margem Liq. %" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
