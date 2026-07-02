import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  subtitle?: string
  color?: string
  trend?: { value: number; positive: boolean }
}

// ---------------------------------------------------------------------------
// Animated counter — counts up from 0 to target over ~1.2s
// ---------------------------------------------------------------------------
function AnimatedCounter({ target }: { target: number }) {
  const [current, setCurrent] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return

    const duration = 1200 // ms
    const steps = 40
    const increment = target / steps
    let step = 0

    const interval = setInterval(() => {
      step++
      if (step >= steps) {
        setCurrent(target)
        clearInterval(interval)
      } else {
        setCurrent(Math.round(increment * step))
      }
    }, duration / steps)

    return () => clearInterval(interval)
  }, [isInView, target])

  return <span ref={ref}>{current.toLocaleString('pt-BR')}</span>
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
export default function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color = '#d4a843',
  trend,
}: StatCardProps) {
  const isNumeric = typeof value === 'number'

  return (
    <motion.div
      whileHover={{ borderColor: color }}
      className={cn(
        'group relative rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6',
        'transition-colors duration-300',
      )}
    >
      {/* Icon */}
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>

      {/* Value */}
      <p className="text-3xl font-bold text-[#f5f5f5]">
        {isNumeric ? <AnimatedCounter target={value as number} /> : value}
      </p>

      {/* Label + trend */}
      <div className="mt-1 flex items-center gap-2">
        <p className="text-sm text-[#a0a0a0]">{label}</p>

        {trend && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trend.positive ? 'text-[#22c55e]' : 'text-[#ef4444]',
            )}
          >
            {trend.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.value}%
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="mt-1 text-xs text-[#6b6b6b]">{subtitle}</p>
      )}
    </motion.div>
  )
}
