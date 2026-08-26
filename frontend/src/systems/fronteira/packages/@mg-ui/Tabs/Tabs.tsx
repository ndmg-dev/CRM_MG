import * as RTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import * as styles from './Tabs.css';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

/**
 * Radix Tabs dá navegação por setas entre abas, role="tablist"/"tab"/"tabpanel"
 * corretos, e ativa por padrão ao focar (pode trocar pra ativação manual se precisar).
 */
export function Tabs({ items, defaultValue, value, onValueChange }: TabsProps) {
  return (
    <RTabs.Root
      defaultValue={defaultValue ?? items[0]?.value}
      value={value}
      onValueChange={onValueChange}
    >
      <RTabs.List className={styles.list}>
        {items.map((item) => (
          <RTabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={styles.trigger}
          >
            {item.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>

      {items.map((item) => (
        <RTabs.Content key={item.value} value={item.value} className={styles.content}>
          {item.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}
