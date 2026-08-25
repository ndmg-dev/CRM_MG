import type { ButtonHTMLAttributes } from 'react';
import * as styles from './Button.css';
import { Spinner } from '../Spinner/Spinner';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

const spinnerSizeFor: Record<Size, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(styles.variant[variant], styles.size[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size={spinnerSizeFor[size]} />}
      {children}
    </button>
  );
}
