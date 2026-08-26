import type { HTMLAttributes } from 'react'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'gold'
  hover?: boolean
}

export default function GlassCard({ variant = 'default', hover = false, className = '', children, ...rest }: GlassCardProps) {
  const variantClass = variant === 'elevated' ? 'glass-card--elevated' : variant === 'gold' ? 'glass-card--gold' : ''
  const hoverClass = hover ? 'glass-card--hover' : ''
  const classes = ['glass-card', variantClass, hoverClass, className].filter(Boolean).join(' ')

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
