import * as RLabel from '@radix-ui/react-label';
import type { ReactNode } from 'react';
import * as styles from './Label.css';

interface LabelProps {
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Radix Label garante que clicar no texto foca/ativa o campo associado
 * (inclusive campos custom como nosso Select/Checkbox/Switch, não só <input> nativo).
 */
export function Label({ htmlFor, children }: LabelProps) {
  return (
    <RLabel.Root className={styles.label} htmlFor={htmlFor}>
      {children}
    </RLabel.Root>
  );
}
