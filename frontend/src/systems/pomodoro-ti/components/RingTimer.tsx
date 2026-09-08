interface RingTimerProps {
  size: number
  strokeWidth: number
  fracElapsed: number // 0..1
  color: string
  trackColor?: string
  children?: React.ReactNode
}

/** Anel de progresso SVG compartilhado entre o timer principal (240px) e o
 * mini-anel do widget flutuante (52px) — mesmo desenho, raio calculado a
 * partir de size/strokeWidth pra não duplicar a matemática do dasharray. */
export function RingTimer({ size, strokeWidth, fracElapsed, color, trackColor = 'var(--color-card)', children }: RingTimerProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, fracElapsed)))

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.3s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
