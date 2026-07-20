// @ts-nocheck
import * as RSelect from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import * as styles from './Select.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  /** controlado */
  value?: string;
  onValueChange?: (value: string) => void;
  /** não-controlado */
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  /** nome acessível do campo (obrigatório se não houver <label> associada) */
  'aria-label'?: string;
}

/**
 * Wrapper fino sobre @radix-ui/react-select.
 *
 * O Radix entrega, sem código nosso:
 *   • navegação completa por teclado (setas, Home/End, digitar pra buscar item)
 *   • posicionamento inteligente (abre pra cima/baixo conforme o espaço — modo popper)
 *   • --radix-select-trigger-width / --available-height p/ o dropdown se ajustar
 *   • roles/aria de listbox + option, foco e "checked" corretos
 *   • fecha no ESC / clique fora, trava scroll de fundo
 *
 * Nós entramos com o VISUAL (Select.css.ts) e a API de options[].
 */
export function Select({
  options,
  value,
  onValueChange,
  defaultValue,
  placeholder = 'Selecione…',
  disabled,
  'aria-label': ariaLabel,
}: SelectProps) {
  return (
    <RSelect.Root
      value={value}
      onValueChange={onValueChange}
      defaultValue={defaultValue}
      disabled={disabled}
    >
      <RSelect.Trigger className={styles.trigger} aria-label={ariaLabel}>
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon className={styles.icon}>
          <ChevronDown size={16} />
        </RSelect.Icon>
      </RSelect.Trigger>

      <RSelect.Portal>
        <RSelect.Content className={styles.content} position="popper" sideOffset={6}>
          <RSelect.ScrollUpButton className={styles.scrollButton}>
            <ChevronUp size={14} />
          </RSelect.ScrollUpButton>

          <RSelect.Viewport className={styles.viewport}>
            {options.map((opt) => (
              <RSelect.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className={styles.item}
              >
                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
                <RSelect.ItemIndicator className={styles.itemIndicator}>
                  <Check size={14} />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>

          <RSelect.ScrollDownButton className={styles.scrollButton}>
            <ChevronDown size={14} />
          </RSelect.ScrollDownButton>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
