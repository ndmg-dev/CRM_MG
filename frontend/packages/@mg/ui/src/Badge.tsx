import type { ReactNode } from 'react';
import * as styles from './Badge.css';

interface BadgeProps {
  variant?: 'ok' | 'warn' | 'err' | 'neutral';
  children: ReactNode;
}

/** Puramente visual — pílula de status. Sem primitivo Radix, não precisa. */
export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={styles.variant[variant]}>{children}</span>;
}
