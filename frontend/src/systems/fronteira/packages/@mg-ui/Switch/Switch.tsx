import * as RSwitch from '@radix-ui/react-switch';
import * as styles from './Switch.css';

interface SwitchProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  defaultChecked?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Radix Switch dá role="switch" + aria-checked e toggle por teclado (espaço). */
export function Switch({
  id,
  checked,
  onCheckedChange,
  defaultChecked,
  disabled,
  'aria-label': ariaLabel,
}: SwitchProps) {
  return (
    <RSwitch.Root
      id={id}
      className={styles.root}
      checked={checked}
      onCheckedChange={onCheckedChange}
      defaultChecked={defaultChecked}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <RSwitch.Thumb className={styles.thumb} />
    </RSwitch.Root>
  );
}
