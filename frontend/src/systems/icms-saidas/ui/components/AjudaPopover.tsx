import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import "./ajuda.css";

// Só um popover de ajuda aberto por vez: quem abre avisa os outros.
const fechadores = new Set<(id: string) => void>();

/**
 * Botão "?" com texto de ajuda. Abre por clique, toque, Enter ou Espaço; fecha com Esc (devolvendo o foco), clique fora ou "Fechar".
 * Nunca abre por hover. Fica FORA do <label> do campo (botão dentro de label vira o controle rotulado).
 * `alinhar="fim"` abre o balão para a esquerda (colunas numéricas, alinhadas à direita).
 */
export function AjudaPopover({ rotulo, texto, alinhar = "inicio" }: { rotulo: string; texto: string; alinhar?: "inicio" | "fim" }) {
  const [aberta, setAberta] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const fechar = (outro: string) => outro !== id && setAberta(false);
    fechadores.add(fechar);
    return () => {
      fechadores.delete(fechar);
    };
  }, [id]);

  useEffect(() => {
    if (!aberta) return;
    fechadores.forEach((f) => f(id));
    function foraDaAjuda(evento: Event) {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAberta(false);
    }
    function tecla(evento: globalThis.KeyboardEvent) {
      if (evento.key === "Escape") {
        setAberta(false);
        botao.current?.focus();
      }
    }
    document.addEventListener("pointerdown", foraDaAjuda);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", foraDaAjuda);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberta, id]);

  // Enter/Espaço tratados aqui (com preventDefault, para o navegador não gerar um clique a mais).
  function teclaNoBotao(evento: KeyboardEvent<HTMLButtonElement>) {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      setAberta((a) => !a);
    }
  }

  return (
    <span className="ajuda" ref={raiz} data-alinhar={alinhar}>
      <button
        ref={botao}
        type="button"
        className="ajuda__botao"
        aria-label={`Ajuda: ${rotulo}`}
        aria-expanded={aberta}
        aria-controls={id}
        onClick={() => setAberta((a) => !a)}
        onKeyDown={teclaNoBotao}
      >
        ?
      </button>
      <span id={id} className="ajuda__balao" hidden={!aberta}>
        <span className="ajuda__texto">{texto}</span>
        <button
          type="button"
          className="ajuda__fechar"
          onClick={() => {
            setAberta(false);
            botao.current?.focus();
          }}
        >
          Fechar
        </button>
      </span>
    </span>
  );
}
