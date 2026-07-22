import { cn } from '@calc/lib/utils';
import { ReactNode } from 'react';

interface CardGraphiteProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CardGraphite({ children, className, size = 'md' }: CardGraphiteProps) {
  const sizeClasses = {
    sm: 'card-graphite-sm',
    md: 'card-graphite',
    lg: 'card-graphite max-w-4xl',
  };

  return (
    <div className={cn(sizeClasses[size], className)}>
      {children}
    </div>
  );
}
