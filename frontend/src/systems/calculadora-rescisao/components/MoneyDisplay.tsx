import { cn } from '@calc/lib/utils';
import { formatarMoeda } from '@calc/lib/calculos';

interface MoneyDisplayProps {
  value: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  positive?: boolean;
  className?: string;
}

export function MoneyDisplay({ value, size = 'md', positive, className }: MoneyDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-3xl font-bold',
  };

  const colorClass = positive === undefined 
    ? 'text-foreground' 
    : positive 
      ? 'text-green-400' 
      : 'text-red-400';

  return (
    <span className={cn('font-mono-numbers', sizeClasses[size], colorClass, className)}>
      R$ {formatarMoeda(value)}
    </span>
  );
}
