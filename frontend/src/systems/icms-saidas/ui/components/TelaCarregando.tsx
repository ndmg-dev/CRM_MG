import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { assinar, lerEntradas } from "../carregando";
import "./carregando.css";

/** Só aparece se a espera passar disto: operações rápidas não piscam a tela. */
export const ATRASO_MS = 300;
/** Uma vez aparecida, fica ao menos este tempo: some sem "piscar" quando a resposta chega logo depois. */
export const MINIMO_MS = 500;

/**
 * Tela de carregamento que bloqueia a página: indicador no centro e o fundo escurecido e translúcido. Usa <dialog> modal nativo,
 * então o resto da página fica inerte (nem clique nem teclado). Esc não fecha. Aparece sozinha enquanto há requisição em andamento
 * (ver `requisitar` em api.ts) e some sozinha quando termina. Monte UMA vez, na raiz do app.
 */
export function TelaCarregando() {
  const entradas = useSyncExternalStore(assinar, lerEntradas);
  const ativo = entradas.length > 0;
  const textoAtual = ativo ? entradas[entradas.length - 1].texto : null;
  const [visivel, setVisivel] = useState(false);
  const [texto, setTexto] = useState("Carregando…");
  const desde = useRef(0);
  const dialogo = useRef<HTMLDialogElement>(null);
  const anterior = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (textoAtual !== null) setTexto(textoAtual);
  }, [textoAtual]);

  useEffect(() => {
    if (ativo && !visivel) {
      const t = window.setTimeout(() => {
        desde.current = Date.now();
        setVisivel(true);
      }, ATRASO_MS);
      return () => window.clearTimeout(t);
    }
    if (!ativo && visivel) {
      const resta = Math.max(0, MINIMO_MS - (Date.now() - desde.current));
      const t = window.setTimeout(() => setVisivel(false), resta);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [ativo, visivel]);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (visivel && !el.open) {
      anterior.current = document.activeElement as HTMLElement | null;
      el.showModal();
    } else if (!visivel && el.open) {
      el.close();
      anterior.current?.focus();
    }
  }, [visivel]);

  return (
    <dialog ref={dialogo} className="carregando" aria-label="Carregando" onCancel={(e) => e.preventDefault()}>
      <div className="carregando__caixa" role="status" aria-live="polite">
        <span className="carregando__giro" aria-hidden="true" />
        <p className="carregando__texto">{texto}</p>
      </div>
    </dialog>
  );
}
