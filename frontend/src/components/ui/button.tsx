import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a843] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:pointer-events-none disabled:opacity-50 rounded-md',
  {
    variants: {
      variant: {
        default:
          'bg-[#d4a843] text-black hover:bg-[#c9952b] active:bg-[#b8941f]',
        secondary:
          'bg-[#252525] text-[#f5f5f5] hover:bg-[#333333] active:bg-[#3a3a3a]',
        destructive:
          'bg-[#ef4444] text-white hover:bg-[#dc2626] active:bg-[#b91c1c]',
        outline:
          'border border-[#333333] bg-transparent text-[#f5f5f5] hover:bg-[#1e1e1e] active:bg-[#252525]',
        ghost:
          'bg-transparent text-[#f5f5f5] hover:bg-[#1e1e1e] active:bg-[#252525]',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
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
