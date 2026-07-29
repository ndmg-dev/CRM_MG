import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type IconBadgeTone = 'gold' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

const TONES: Record<IconBadgeTone, string> = {
  gold: 'bg-gold-muted text-gold',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  error: 'bg-error-soft text-error',
  info: 'bg-info-soft text-info',
  neutral: 'bg-surface text-text-muted',
}

const SIZES = {
  sm: 'h-7 w-7 rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5',
  md: 'h-[34px] w-[34px] rounded-lg [&_svg]:h-[18px] [&_svg]:w-[18px]',
}

interface IconBadgeProps {
  icon: LucideIcon
  tone?: IconBadgeTone
  size?: keyof typeof SIZES
  className?: string
}

/**
 * Badge quadrado que envolve o ícone de um KPI ou de uma linha de evento.
 * A cor fica no ícone e no fundo translúcido — nunca no card inteiro.
 */
export default function IconBadge({
  icon: Icon,
  tone = 'gold',
  size = 'md',
  className,
}: IconBadgeProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center', SIZES[size], TONES[tone], className)}
    >
      <Icon />
    </div>
  )
}
