import {
  ScatterChart as RechartsScatter,
  Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ZAxis, Legend, Cell,
} from 'recharts';
import { COLORS, CHART_COLORS, EXPECTATION_COLORS } from '../../utils/colors';
import { formatBRL, formatTenure } from '../../utils/formatters';

/**
 * Scatter plot for Career Horizon Matrix (tenure x salary, color = expectation).
 *
 * @param {object} props
 * @param {Array<{tenure: number, salary: number, expectation: boolean, role: string}>} props.data
 * @param {number} [props.height=400]
 */
export default function ScatterChart({ data, height = 400 }) {
  const positiveData = data?.filter(d => d.expectation) || [];
  const negativeData = data?.filter(d => !d.expectation) || [];

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{
        background: COLORS.glassBg,
        border: `1px solid ${COLORS.glassBorder}`,
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '0.8125rem',
        color: COLORS.textPrimary,
      }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.role}</p>
        <p style={{ color: COLORS.textSecondary }}>
          Tempo: {formatTenure(d.tenure)}
        </p>
        <p style={{ color: COLORS.textSecondary }}>
          Salário: {formatBRL(d.salary)}
        </p>
        <p style={{ color: d.expectation ? COLORS.positive : COLORS.negative }}>
          {d.expectation ? '✓ Positiva' : '✗ Negativa'}
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsScatter margin={{ top: 10, right: 20, left: 20, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey="tenure"
          name="Tempo"
          tick={{ fill: COLORS.textSecondary, fontSize: 12 }}
          axisLine={{ stroke: CHART_COLORS.grid }}
          label={{ value: 'Tempo de Empresa (anos)', position: 'bottom', offset: 15, fill: COLORS.textMuted, fontSize: 12 }}
        />
        <YAxis
          dataKey="salary"
          name="Salário"
          tick={{ fill: COLORS.textSecondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Salário (R$)', angle: -90, position: 'insideLeft', offset: -5, fill: COLORS.textMuted, fontSize: 12 }}
        />
        <ZAxis range={[60, 60]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '0.8125rem', color: COLORS.textSecondary }} />

        <Scatter name="Expectativa Positiva" data={positiveData} fill={EXPECTATION_COLORS.positive}>
          {positiveData.map((_, i) => (
            <Cell key={i} fill={EXPECTATION_COLORS.positive} fillOpacity={0.7} />
          ))}
        </Scatter>
        <Scatter name="Expectativa Negativa" data={negativeData} fill={EXPECTATION_COLORS.negative}>
          {negativeData.map((_, i) => (
            <Cell key={i} fill={EXPECTATION_COLORS.negative} fillOpacity={0.7} />
          ))}
        </Scatter>
      </RechartsScatter>
    </ResponsiveContainer>
  );
}
