import type { InputHTMLAttributes } from 'react';
import * as styles from './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** mensagem de erro; quando presente, seta aria-invalid e pinta a borda de vermelho */
  error?: string;
}

/**
 * Sem primitivo Radix — <input> nativo já é acessível por padrão. O valor do DS aqui
 * é só o visual consistente (tokens) + o contrato de erro (`error` -> aria-invalid).
 */
export function Input({ error, className, ...props }: InputProps) {
  const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
  return (
    <div>
      <input
        className={cx(styles.input, className)}
        aria-invalid={!!error}
        {...props}
      />
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}
