import { useId, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import type { LinkProps } from "react-router-dom";

import { Link } from "../../roteamento";

import "./botao.css";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
  variante?: "primario" | "secundario" | "perigo" | "fantasma";
  tamanho?: "compacto" | "padrao" | "principal";
  /** Em andamento: `disabled` + `aria-busy` (impede duplo envio). */
  carregando?: boolean;
  /** Indisponível por regra: continua focável (`aria-disabled`) e o motivo aparece ao lado, ligado por `aria-describedby`. */
  desabilitadoMotivo?: string | null;
  /** Indisponível sem motivo a mostrar (ex.: formulário travado). */
  desabilitado?: boolean;
  /** Ícone decorativo antes do texto (fica `aria-hidden`). */
  icone?: ReactNode;
  children: ReactNode;
};

export function Botao({
  variante = "secundario",
  tamanho = "padrao",
  carregando = false,
  desabilitadoMotivo,
  desabilitado = false,
  icone,
  type = "button",
  className,
  onClick,
  children,
  ...resto
}: Props) {
  const idMotivo = useId();
  const indisponivel = !!desabilitadoMotivo;

  function clicar(evento: MouseEvent<HTMLButtonElement>) {
    // aria-disabled não bloqueia o clique (nem o envio implícito do formulário por Enter): bloqueio aqui.
    if (indisponivel || carregando) {
      evento.preventDefault();
      return;
    }
    onClick?.(evento);
  }

  const descritoPor = [resto["aria-describedby"], indisponivel ? idMotivo : null].filter(Boolean).join(" ") || undefined;

  const botao = (
    <button
      {...resto}
      type={type}
      className={["botao", `botao--${variante}`, `botao--${tamanho}`, className].filter(Boolean).join(" ")}
      disabled={carregando || desabilitado}
      aria-busy={carregando || undefined}
      aria-disabled={indisponivel || undefined}
      aria-describedby={descritoPor}
      onClick={clicar}
    >
      {carregando && <span className="botao__giro" aria-hidden="true" />}
      {icone && (
        <span className="botao__icone" aria-hidden="true">
          {icone}
        </span>
      )}
      {children}
    </button>
  );

  // Estrutura estável: o <button> não é recriado quando o motivo aparece ou some (não perde o foco).
  return (
    <>
      {botao}
      {indisponivel && (
        <span id={idMotivo} className="botao__motivo">
          {desabilitadoMotivo}
        </span>
      )}
    </>
  );
}

/** Navegação com aparência de botão (ex.: "Nova empresa"): um link de verdade, não um botão. */
export function BotaoLink({
  variante = "secundario",
  tamanho = "padrao",
  className,
  ...resto
}: Omit<LinkProps, "to"> & { to: string; variante?: "primario" | "secundario" | "fantasma"; tamanho?: "compacto" | "padrao" | "principal" }) {
  return <Link {...resto} className={["botao", `botao--${variante}`, `botao--${tamanho}`, className].filter(Boolean).join(" ")} />;
}

/** Cadeado de traço (usado em ações bloqueadas e no alerta de bloqueio). */
export function IconeCadeado() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
