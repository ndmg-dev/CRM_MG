// @ts-nocheck
import * as RDropdown from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import * as styles from './DropdownMenu.css';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export interface DropdownMenuItem {
  type?: 'item' | 'separator' | 'label';
  label?: string;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: ReactNode;
}

interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: 'start' | 'center' | 'end';
}

/**
 * Radix Dropdown Menu dá navegação completa por teclado (setas, Home/End, digitar
 * pra buscar), fecha ao selecionar ou no ESC/clique fora, e Portal — o mesmo tipo
 * de comportamento do Select, mas para ações em vez de valor selecionado.
 */
export function DropdownMenu({ trigger, items, align = 'end' }: DropdownMenuProps) {
  return (
    <RDropdown.Root>
      <RDropdown.Trigger asChild>{trigger}</RDropdown.Trigger>
      <RDropdown.Portal>
        <RDropdown.Content className={styles.content} align={align} sideOffset={6}>
          {items.map((entry, i) => {
            if (entry.type === 'separator') {
              return <RDropdown.Separator key={i} className={styles.separator} />;
            }
            if (entry.type === 'label') {
              return (
                <RDropdown.Label key={i} className={styles.label}>
                  {entry.label}
                </RDropdown.Label>
              );
            }
            return (
              <RDropdown.Item
                key={i}
                className={cx(styles.item, entry.danger && styles.itemDanger)}
                disabled={entry.disabled}
                onSelect={entry.onSelect}
              >
                {entry.icon}
                {entry.label}
              </RDropdown.Item>
            );
          })}
        </RDropdown.Content>
      </RDropdown.Portal>
    </RDropdown.Root>
  );
}
