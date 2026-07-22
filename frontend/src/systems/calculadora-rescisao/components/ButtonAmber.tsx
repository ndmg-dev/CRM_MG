import { cn } from '@calc/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonAmberProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const ButtonAmber = forwardRef<HTMLButtonElement, ButtonAmberProps>(
  ({ className, variant = 'solid', size = 'md', children, ...props }, ref) => {
    const baseClasses = 'rounded-xl font-semibold transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
      solid: 'btn-amber',
      outline: 'btn-amber-outline',
      ghost: 'bg-transparent text-primary hover:bg-primary/10 focus:ring-2 focus:ring-primary/40',
    };

    const sizeClasses = {
      sm: 'h-9 px-4 text-sm',
      md: 'h-11 px-6 text-base',
      lg: 'h-12 px-8 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

ButtonAmber.displayName = 'ButtonAmber';
