import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { COLORS } from '../../utils/colors';

/**
 * Donut chart component themed for the dashboard.
 *
 * @param {object} props
 * @param {Array<{name: string, value: number}>} props.data
 * @param {Array<string>} [props.colors] — fill colors per segment
 * @param {number} [props.height=300]
 * @param {number} [props.innerRadius=65]
 * @param {number} [props.outerRadius=100]
 * @param {React.ReactNode} [props.centerLabel] — element to render in the center
 */
export default function DonutChart({
  data,
  colors,
  height = 300,
  innerRadius = 65,
  outerRadius = 100,
  centerLabel,
}) {
  const fillColors = colors || [COLORS.positive, COLORS.negative, COLORS.gold, COLORS.silver];

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            dataKey="value"
            stroke="none"
            animationBegin={200}
            animationDuration={1000}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={fillColors[index % fillColors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: COLORS.glassBg,
              border: `1px solid ${COLORS.glassBorder}`,
              borderRadius: '12px',
              color: COLORS.textPrimary,
              fontSize: '0.8125rem',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.8125rem', color: COLORS.textSecondary }}
          />
        </PieChart>
      </ResponsiveContainer>

      {centerLabel && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          {centerLabel}
        </div>
      )}
    </div>
  );
}
