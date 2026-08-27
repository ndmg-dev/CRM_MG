import AnimatedCounter from './AnimatedCounter';
import GlassCard from './GlassCard';
import { TrendingUp, TrendingDown } from 'react-feather';

/**
 * KPI metric card with animated number, icon, and optional trend.
 *
 * @param {object} props
 * @param {string} props.label — KPI name
 * @param {number} props.value — numeric value
 * @param {React.ReactNode} [props.icon] — Feather icon element
 * @param {string} [props.prefix] — prefix for the number
 * @param {string} [props.suffix] — suffix for the number
 * @param {number} [props.decimals=0]
 * @param {'up'|'down'|'neutral'} [props.trend]
 * @param {string} [props.trendLabel]
 * @param {string} [props.className]
 * @param {number} [props.delay=0] — animation delay index
 */
export default function MetricCard({
  label,
  value,
  icon,
  prefix = '',
  suffix = '',
  decimals = 0,
  trend,
  trendLabel,
  description,
  className = '',
  delay = 0,
}) {
  const trendClass = trend === 'up' ? 'text-positive' : trend === 'down' ? 'text-negative' : '';

  return (
    <GlassCard
      hoverable
      goldAccent
      className={`metric-card animate-slide-up delay-${delay} ${className}`}
    >
      <div className="metric-card__header">
        {icon && <span className="metric-card__icon">{icon}</span>}
        <span className="metric-card__label">{label}</span>
      </div>
      <div className="metric-card__value">
        <AnimatedCounter
          end={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
        />
      </div>
      {trend && trendLabel && (
        <div className={`metric-card__trend ${trendClass}`}>
          {trend === 'up' ? <TrendingUp size={14} /> : trend === 'down' ? <TrendingDown size={14} /> : null}
          <span>{trendLabel}</span>
        </div>
      )}
      {description && (
        <div className="metric-card__description" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>
          {description}
        </div>
      )}
    </GlassCard>
  );
}
