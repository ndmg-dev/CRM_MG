import { cn } from '@calc/lib/utils';
import { useState, useEffect, forwardRef } from 'react';

interface CpfCnpjInputProps {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  placeholder?: string;
  className?: string;
}

function maskCpf(v: string): string {
  return v
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskCnpj(v: string): string {
  return v
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) return maskCpf(digits);
  return maskCnpj(digits);
}

function getType(raw: string): 'cpf' | 'cnpj' | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 11) return digits.length > 0 ? 'cpf' : null;
  return 'cnpj';
}

export const CpfCnpjInput = forwardRef<HTMLInputElement, CpfCnpjInputProps>(
  ({ value, onChange, placeholder, className }, ref) => {
    const [display, setDisplay] = useState(() => applyMask(value || ''));

    useEffect(() => {
      setDisplay(applyMask(value || ''));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const masked = applyMask(e.target.value);
      setDisplay(masked);
      onChange({ target: { value: masked } });
    };

    const type = getType(display);
    const label = type === 'cnpj' ? 'CNPJ' : type === 'cpf' ? 'CPF' : 'CPF/CNPJ';

    return (
      <div className="relative">
        <input
          ref={ref}
          className={cn('input-dark w-full pr-16', className)}
          value={display}
          onChange={handleChange}
          placeholder={placeholder || '000.000.000-00'}
          inputMode="numeric"
        />
        {type && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
            {label}
          </span>
        )}
      </div>
    );
  }
);

CpfCnpjInput.displayName = 'CpfCnpjInput';
