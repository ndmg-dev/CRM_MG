import { cn } from '@calc/lib/utils';
import { forwardRef, useState, useEffect } from 'react';
import { formatarMoeda, parseMoeda } from '@calc/lib/calculos';

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, placeholder = 'R$ 0,00', className, disabled }, ref) => {
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (!isFocused && value > 0) {
        setDisplayValue(`R$ ${formatarMoeda(value)}`);
      } else if (!isFocused && value === 0) {
        setDisplayValue('');
      }
    }, [value, isFocused]);

    const handleFocus = () => {
      setIsFocused(true);
      if (value > 0) {
        setDisplayValue(formatarMoeda(value));
      } else {
        setDisplayValue('');
      }
    };

    const handleBlur = () => {
      setIsFocused(false);
      const numericValue = parseMoeda(displayValue);
      onChange(numericValue);
      if (numericValue > 0) {
        setDisplayValue(`R$ ${formatarMoeda(numericValue)}`);
      } else {
        setDisplayValue('');
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      setDisplayValue(rawValue);
      const numericValue = parseMoeda(rawValue);
      onChange(numericValue);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        className={cn('input-dark w-full', className)}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
      />
    );
  }
);

MoneyInput.displayName = 'MoneyInput';
