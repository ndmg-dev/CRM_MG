interface LeadTimeCardProps {
  label: string
  value: number | string
  unit?: string
  subtitle?: string
  color: string
}

export default function LeadTimeCard({ label, value, unit, subtitle, color }: LeadTimeCardProps) {
  return (
    <div className="card" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${color}, transparent 80%)`,
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -20,
          left: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <p
        style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: 14,
        }}
      >
        {label}
      </p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 40,
            fontWeight: 800,
            color,
            lineHeight: 1,
            textShadow: `0 0 30px ${color}15`,
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>

      {subtitle && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
