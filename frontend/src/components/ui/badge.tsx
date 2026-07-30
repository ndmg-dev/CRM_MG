import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-[1.5] transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-gold-border bg-gold-muted text-gold',
        secondary:
          'border-border-light bg-surface-raised text-text-secondary',
        success:
          'border-success/25 bg-success-soft text-success',
        warning:
          'border-warning/25 bg-warning-soft text-warning',
        error:
          'border-error/25 bg-error-soft text-error',
        info:
          'border-info/25 bg-info-soft text-info',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
