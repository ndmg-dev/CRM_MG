import * as RCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import * as styles from './Checkbox.css';

interface CheckboxProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  defaultChecked?: boolean;
  disabled?: boolean;
  label?: ReactNode;
}

/**
 * Radix Checkbox entrega estado tri-valor correto (checked/unchecked/indeterminate),
 * role="checkbox" com aria-checked, e navegação por espaço/tab — sem isso um
 * checkbox "estilizado na mão" quase sempre erra a acessibilidade.
 */
export function Checkbox({
  id,
  checked,
  onCheckedChange,
  defaultChecked,
  disabled,
  label,
}: CheckboxProps) {
  const control = (
    <RCheckbox.Root
      id={id}
      className={styles.root}
      checked={checked}
      onCheckedChange={onCheckedChange}
      defaultChecked={defaultChecked}
      disabled={disabled}
    >
      <RCheckbox.Indicator className={styles.indicator}>
        <Check size={12} strokeWidth={3} />
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );

  if (!label) return control;

  return (
    <label className={styles.wrapper} htmlFor={id}>
      {control}
      <span className={styles.text}>{label}</span>
    </label>
  );
}
