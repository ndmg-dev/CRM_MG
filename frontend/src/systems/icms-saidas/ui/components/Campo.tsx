import type { FormHTMLAttributes, ReactNode } from "react";

import "./campo.css";

/**
 * Campo de formulário: rótulo visível em volta do controle (o <label> envolve o <input>/<select>), marca "(opcional)",
 * dica e erro abaixo. O controle leva a classe `campo__controle`.
 */
export function Campo({
  rotulo,
  opcional = false,
  dica,
  erro,
  className,
  children,
}: {
  rotulo: ReactNode;
  opcional?: boolean;
  dica?: ReactNode;
  erro?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={["campo", className].filter(Boolean).join(" ")}>
      <span className="campo__rotulo">
        {rotulo}
        {opcional && <span className="campo__opcional"> (opcional)</span>}
      </span>
      {children}
      {dica && <span className="campo__dica">{dica}</span>}
      {erro && <span className="campo__erro">{erro}</span>}
    </label>
  );
}

/** Formulário em coluna; `estreito` limita a largura (telas de conta e cadastro). */
export function Formulario({
  estreito = false,
  className,
  ...resto
}: FormHTMLAttributes<HTMLFormElement> & { estreito?: boolean }) {
  return <form {...resto} className={["formulario", estreito && "formulario--estreito", className].filter(Boolean).join(" ")} />;
}
