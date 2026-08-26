import type { HTMLAttributes } from 'react'

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'gold' | 'silver'
}

export default function StatusBadge({ variant = 'info', children, className = '', ...rest }: StatusBadgeProps) {
  const classes = ['status-badge', `status-badge--${variant}`, className].filter(Boolean).join(' ')

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  )
}
