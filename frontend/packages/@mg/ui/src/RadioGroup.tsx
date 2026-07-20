// @ts-nocheck
import * as RRadio from '@radix-ui/react-radio-group';
import * as styles from './RadioGroup.css';

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  'aria-label'?: string;
}

/**
 * Radix RadioGroup dá navegação por setas entre os itens (padrão de radio nativo)
 * e garante que só um esteja marcado — regra fácil de esquecer numa implementação manual.
 */
export function RadioGroup({
  options,
  value,
  onValueChange,
  defaultValue,
  'aria-label': ariaLabel,
}: RadioGroupProps) {
  return (
    <RRadio.Root
      className={styles.root}
      value={value}
      onValueChange={onValueChange}
      defaultValue={defaultValue}
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <label key={opt.value} className={styles.wrapper}>
          <RRadio.Item
            className={styles.item}
            value={opt.value}
            disabled={opt.disabled}
          >
            <RRadio.Indicator className={styles.indicator} />
          </RRadio.Item>
          <span className={styles.text}>{opt.label}</span>
        </label>
      ))}
    </RRadio.Root>
  );
}
