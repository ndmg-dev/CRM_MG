import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-gold text-background hover:bg-gold-hover active:bg-gold-active',
        secondary:
          'border border-border bg-surface-raised text-text-primary hover:border-border-light hover:bg-surface active:bg-surface-hover',
        // Destrutivo translúcido, como na referência — vermelho sólido fica
        // pesado demais numa interface desta densidade.
        destructive:
          'border border-error/35 bg-error-soft text-error hover:bg-error/20 active:bg-error/25',
        outline:
          'border border-border-light bg-transparent text-text-primary hover:bg-surface active:bg-surface-hover',
        ghost:
          'bg-transparent text-text-secondary hover:bg-surface hover:text-text-primary active:bg-surface-hover',
      },
      size: {
        sm: 'h-8 px-2.5 text-[12px]',
        default: 'h-9 px-3.5 text-[13px]',
        lg: 'h-10 px-5 text-[14px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
