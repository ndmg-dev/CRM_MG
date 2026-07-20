import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-[#d4a843]/20 bg-gold/10 text-gold',
        secondary:
          'border-border-light bg-surface-hover text-text-secondary',
        success:
          'border-[#22c55e]/20 bg-[#22c55e]/10 text-[#22c55e]',
        warning:
          'border-[#f59e0b]/20 bg-[#f59e0b]/10 text-[#f59e0b]',
        error:
          'border-[#ef4444]/20 bg-[#ef4444]/10 text-[#ef4444]',
        info:
          'border-[#3b82f6]/20 bg-[#3b82f6]/10 text-[#3b82f6]',
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
