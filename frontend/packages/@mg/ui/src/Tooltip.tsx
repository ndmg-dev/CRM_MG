import * as RTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import * as styles from './Tooltip.css';

/**
 * Precisa envolver a ÁRVORE DA APP UMA VEZ (não por tooltip) com <TooltipProvider>.
 * Ele controla o delay global e evita reabrir o delay ao mover entre tooltips vizinhos.
 */
export const TooltipProvider = RTooltip.Provider;

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Radix Tooltip cuida de: mostrar só depois do delay (sem "piscar" no hover rápido),
 * fechar no ESC, aria-describedby ligando trigger ao conteúdo, e reposicionar
 * automaticamente se não couber no lado pedido.
 */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content className={styles.content} side={side} sideOffset={6}>
          {content}
          <RTooltip.Arrow className={styles.arrow} />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
