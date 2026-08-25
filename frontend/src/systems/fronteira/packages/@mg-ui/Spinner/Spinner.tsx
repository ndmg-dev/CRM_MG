import * as styles from './Spinner.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'aria-label'?: string;
}

export function Spinner({ size = 'md', className, 'aria-label': ariaLabel = 'Carregando' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={[styles.size[size], className].filter(Boolean).join(' ')}
    />
  );
}
