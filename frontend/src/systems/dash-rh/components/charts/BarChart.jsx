import {
  BarChart as RechartsBarChart,
  Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, LabelList
} from 'recharts';
import { COLORS, CHART_COLORS } from '../../utils/colors';

/**
 * Themed bar chart — supports vertical and horizontal orientations.
 *
 * @param {object} props
 * @param {Array} props.data
 * @param {string} props.xKey — data key for X axis
 * @param {Array<{key: string, color: string, name: string}>} props.bars
 * @param {number} [props.height=350]
 * @param {boolean} [props.horizontal=false] — horizontal layout
 * @param {boolean} [props.stacked=false]
 * @param {boolean} [props.showGrid=true]
 * @param {boolean} [props.showLegend=true]
 */
const CustomXAxisTick = ({ x, y, payload }) => {
  if (!payload || !payload.value) return null;
  let line1 = payload.value;
  let line2 = '';
  // Split at parentheses or space if too long
  // If the label contains parentheses (e.g., "Novato (< 1 ano)"), split it
  const parts = payload.value.split(' (');
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
  const leftMargin = 10;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={layout}
        margin={{ top: 20, right: 20, left: leftMargin, bottom: 30 }}
      >
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
            vertical={!horizontal}
            horizontal={horizontal}
          />
        )}

        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fill: COLORS.textSecondary, fontSize: 12 }} />
            <YAxis
              dataKey={xKey}
              type="category"
              tick={{ fill: COLORS.textSecondary, fontSize: 11 }}
              width={finalYAxisWidth}
              tickMargin={8}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              tick={<CustomXAxisTick />}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={false}
              interval={0}
              height={60}
              tickMargin={12}
            />
            <YAxis
              tick={{ fill: COLORS.textSecondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
          </>
        )}

        <Tooltip
          formatter={tooltipFormatter}
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
              position: 'relative',
              top: '10px'
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
