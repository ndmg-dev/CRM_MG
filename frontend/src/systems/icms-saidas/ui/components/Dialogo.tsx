import { useEffect, useId, useRef, type ReactNode } from "react";

import "./dialogo.css";

const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

type Props = {
  titulo: ReactNode;
  aberto: boolean;
  /** Esc, "Cancelar" e fechar por qualquer outro caminho chamam este callback; quem usa controla `aberto`. */
  onFechar: () => void;
  children: ReactNode;
  /** Botões do rodapé. */
  acoes?: ReactNode;
};

/**
 * Diálogo modal com <dialog> nativo e `showModal()`: o navegador prende o foco e torna o resto da página inerte.
 * Foco inicial no primeiro controle; ao fechar, o foco volta para quem abriu. Esc = cancelar.
 */
export function Dialogo({ titulo, aberto, onFechar, children, acoes }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const anterior = useRef<HTMLElement | null>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) {
      anterior.current = document.activeElement as HTMLElement | null;
      dialogo.showModal();
      dialogo.querySelector<HTMLElement>(FOCAVEIS)?.focus();
    } else if (!aberto && dialogo.open) {
      dialogo.close();
      anterior.current?.focus();
    }
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault(); // quem fecha é o estado de quem usa
        onFechar();
      }}
    >
      <h2 id={idTitulo} className="dialogo__titulo">
        {titulo}
      </h2>
      <div className="dialogo__corpo">{children}</div>
      {acoes && <div className="dialogo__acoes">{acoes}</div>}
    </dialog>
  );
}
