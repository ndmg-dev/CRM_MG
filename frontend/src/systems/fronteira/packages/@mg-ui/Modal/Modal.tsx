import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as styles from './Modal.css';

interface ModalProps {
  /** controlado: passe open + onOpenChange. Se omitir, o Modal se controla via trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** elemento que abre o modal (ex: <Button>Abrir</Button>). Opcional se for controlado. */
  trigger?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  /** rodapé de ações, ex: os botões Cancelar / Confirmar */
  actions?: ReactNode;
}

/**
 * Wrapper fino sobre @radix-ui/react-dialog.
 *
 * O Radix cuida — de graça, sem código nosso — de:
 *   • foco preso dentro do modal (focus trap) e devolvido ao fechar
 *   • fechar no ESC e no clique no overlay
 *   • aria-labelledby (Title) e aria-describedby (Description) automáticos
 *   • Portal (renderiza fora da árvore, sem quebrar z-index/overflow)
 *   • trava o scroll do body enquanto aberto
 *
 * Nós só entramos com o VISUAL (classes do Modal.css.ts) e a API amigável.
 */
export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  actions,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}

      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>

          {description ? (
            <Dialog.Description className={styles.description}>
              {description}
            </Dialog.Description>
          ) : null}

          {children ? <div className={styles.body}>{children}</div> : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}

          <Dialog.Close className={styles.close} aria-label="Fechar">
            <X size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
