import { cn } from '@calc/lib/utils';
import { forwardRef, InputHTMLAttributes, useCallback } from 'react';

interface InputDarkProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  mask?: string;
}

/**
 * Aplica uma máscara de padrão simples ao valor.
 * Convenção (compatível com o antigo react-input-mask):
 *   9 -> dígito | a -> letra | * -> alfanumérico | demais caracteres são literais
 */
function applyPatternMask(value: string, pattern: string): string {
  const raw = value.replace(/[^0-9a-zA-Z]/g, '');
  let out = '';
  let ri = 0;
  for (let pi = 0; pi < pattern.length && ri < raw.length; pi++) {
    const p = pattern[pi];
    const c = raw[ri];
    const isDigit = /[0-9]/.test(c);
    const isAlpha = /[a-zA-Z]/.test(c);
    if (p === '9') {
      if (!isDigit) { ri++; pi--; continue; }
      out += c; ri++;
    } else if (p === 'a') {
      if (!isAlpha) { ri++; pi--; continue; }
      out += c; ri++;
    } else if (p === '*') {
      out += c; ri++;
    } else {
      // caractere literal do padrão
      out += p;
      if (c === p) ri++;
    }
  }
  return out;
}

export const InputDark = forwardRef<HTMLInputElement, InputDarkProps>(
  ({ className, mask, onChange, value, ...props }, ref) => {
    const baseClasses = cn('input-dark w-full', className);

    const handleMaskedChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!onChange) return;
        e.target.value = applyPatternMask(e.target.value, mask as string);
        onChange(e);
      },
      [onChange, mask]
    );

    if (mask) {
      return (
        <input
          ref={ref}
          className={baseClasses}
          value={value}
          onChange={handleMaskedChange}
          {...props}
        />
      );
    }

    return (
      <input ref={ref} className={baseClasses} value={value} onChange={onChange} {...props} />
    );
  }
);

InputDark.displayName = 'InputDark';
