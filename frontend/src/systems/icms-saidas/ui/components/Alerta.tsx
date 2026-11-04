import type { ReactNode } from "react";

import { ErroApi } from "../../api";
import { IconeCadeado } from "./Botao";
import "./alerta.css";

type Props = {
  tipo: "erro" | "aviso" | "sucesso" | "bloqueio";
  titulo: ReactNode;
  /** Frase de consequência (ex.: "Nenhum dado foi alterado"). */
  children?: ReactNode;
  /** Lista (bloqueios, avisos, detalhes do erro). No erro vai numa caixa "Detalhes (N)". */
  detalhes?: ReactNode[];
  /** Linha de metadados (código do erro, horário). */
  meta?: ReactNode;
  acoes?: ReactNode;
  /** Aviso começa fechado (é recolhível). */
  abertoInicialmente?: boolean;
};

/**
 * Erro e bloqueio com `role="alert"`; sucesso com `role="status"`; aviso recolhível com <details>.
 * Bloqueio: borda de 2 px, cadeado, e quem usa o coloca sempre no topo do conteúdo.
 */
export function Alerta({ tipo, titulo, children, detalhes = [], meta, acoes, abertoInicialmente = false }: Props) {
  const lista =
    detalhes.length > 0 ? (
      <ul className="alerta__lista">
        {detalhes.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    ) : null;

  // Aviso só com título não tem o que recolher: vira uma linha simples.
  const recolhivel = children !== undefined || detalhes.length > 0 || acoes !== undefined;
  if (tipo === "aviso" && !recolhivel) {
    return (
      <div className="alerta" data-tipo="aviso" role="status">
        <p className="alerta__titulo">{titulo}</p>
      </div>
    );
  }

  if (tipo === "aviso") {
    return (
      <details className="alerta" data-tipo="aviso" open={abertoInicialmente || undefined}>
        <summary className="alerta__titulo">{titulo}</summary>
        {children && <div className="alerta__texto">{children}</div>}
        {lista}
        {acoes && <div className="alerta__acoes">{acoes}</div>}
      </details>
    );
  }

  return (
    <div className="alerta" data-tipo={tipo} role={tipo === "sucesso" ? "status" : "alert"}>
      <p className="alerta__titulo">
        {tipo === "bloqueio" && (
          <span className="alerta__icone">
            <IconeCadeado />
          </span>
        )}
        {titulo}
      </p>
      {children && <div className="alerta__texto">{children}</div>}
      {lista &&
        (tipo === "erro" ? (
          <details className="alerta__detalhes">
            <summary>Detalhes ({detalhes.length})</summary>
            {lista}
          </details>
        ) : (
          lista
        ))}
      {meta && <p className="alerta__meta">{meta}</p>}
      {acoes && <div className="alerta__acoes">{acoes}</div>}
    </div>
  );
}

/** Mensagem, código e detalhes de um erro do BFF/motor (ou de rede). */
export function lerErro(erro: unknown): { mensagem: string; codigo: string | null; detalhes: string[] } {
  if (erro instanceof ErroApi) return { mensagem: erro.message, codigo: erro.codigo, detalhes: erro.detalhes };
  return { mensagem: erro instanceof Error ? erro.message : "Erro inesperado.", codigo: null, detalhes: [] };
}
