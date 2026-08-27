import {
  BarChart as RechartsBarChart,
  Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList
} from 'recharts';
import { COLORS, CHART_COLORS } from '../../utils/colors';

/**
 * Themed bar chart — supports vertical and horizontal orientations.
 *
 * NOTA (migração p/ o CRM): o CRM usa recharts@2, o HR-DASH-MG usava @3. O
 * recharts@2 NÃO enxerga <XAxis>/<YAxis> dentro de um React.Fragment (só varre
 * filhos diretos do gráfico), então aqui os eixos são sempre filhos diretos e
 * as diferenças horizontal/vertical entram via spread de props, nunca via
 * agrupamento condicional.
 *
 * @param {object} props
 * @param {Array} props.data
 * @param {string} props.xKey — data key for the category axis
 * @param {Array<{key: string, color: string, name: string}>} props.bars
 * @param {number} [props.height=350]
 * @param {boolean} [props.horizontal=false] — horizontal (barras deitadas)
 * @param {boolean} [props.stacked=false]
 * @param {boolean} [props.showGrid=true]
 * @param {boolean} [props.showLegend=true]
 */
const CustomXAxisTick = ({ x, y, payload }) => {
  if (!payload || !payload.value) return null;
  const parts = String(payload.value).split(' (');
  if (parts.length > 1) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={22} textAnchor="middle" fill={COLORS.textSecondary} fontSize={11}>
          {parts[0]}
        </text>
        <text x={0} y={0} dy={36} textAnchor="middle" fill={COLORS.textSecondary} fontSize={10}>
          ({parts[1]}
        </text>
      </g>
    );
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={22} textAnchor="middle" fill={COLORS.textSecondary} fontSize={12}>
        {payload.value}
      </text>
    </g>
  );
};

export default function BarChart({
  data,
  xKey,
  bars,
  height = 350,
  horizontal = false,
  stacked = false,
  showGrid = true,
  showLegend = true,
  tooltipFormatter,
  yAxisWidth,
}) {
  const layout = horizontal ? 'vertical' : 'horizontal';
  const finalYAxisWidth = yAxisWidth || (horizontal ? 150 : 60);

  const xAxisProps = horizontal
    ? {
        type: 'number',
        tick: { fill: COLORS.textSecondary, fontSize: 12 },
        axisLine: { stroke: CHART_COLORS.grid },
        tickLine: false,
      }
    : {
        type: 'category',
        dataKey: xKey,
        tick: <CustomXAxisTick />,
        axisLine: { stroke: CHART_COLORS.grid },
        tickLine: false,
        interval: 0,
        height: 60,
        tickMargin: 12,
      };

  const yAxisProps = horizontal
    ? {
        type: 'category',
        dataKey: xKey,
        tick: { fill: COLORS.textSecondary, fontSize: 11 },
        width: finalYAxisWidth,
        tickMargin: 8,
        axisLine: false,
        tickLine: false,
      }
    : {
        type: 'number',
        tick: { fill: COLORS.textSecondary, fontSize: 12 },
        axisLine: false,
        tickLine: false,
      };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={layout}
        margin={{ top: 20, right: 20, left: 10, bottom: 30 }}
      >
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
            vertical={!horizontal}
            horizontal={horizontal}
          />
        )}

        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />

        <Tooltip
          formatter={tooltipFormatter}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{
            background: COLORS.glassBg,
            border: `1px solid ${COLORS.glassBorder}`,
            borderRadius: '12px',
            color: COLORS.textPrimary,
            fontSize: '0.8125rem',
          }}
        />

        {showLegend && (
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{
              fontSize: '0.8125rem',
              color: COLORS.textSecondary,
              paddingTop: '20px',
            }}
          />
        )}

        {bars.map((bar, i) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name || bar.key}
            fill={bar.color || CHART_COLORS.series[i]}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            stackId={stacked ? 'stack' : undefined}
            maxBarSize={horizontal ? 28 : 56}
            animationBegin={i * 100}
            animationDuration={800}
          >
            <LabelList
              dataKey={bar.key}
              position={bar.labelPosition || 'center'}
              fill={bar.labelColor || '#0A0A10'}
              fontSize={11}
              fontWeight={700}
              formatter={bar.labelFormatter || ((value) => (value > 0 ? value : ''))}
            />
          </Bar>
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
