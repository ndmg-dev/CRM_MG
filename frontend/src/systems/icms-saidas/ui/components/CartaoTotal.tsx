import type { ReactNode } from "react";

import { formatarReais } from "../../formato";
import { AjudaPopover } from "./AjudaPopover";
import "./cartao.css";

export const AVISO_SALDO = "Não é o ICMS a recolher";

type Props = {
  rotulo: string;
  /** Valor em R$ (formatado com símbolo). Ausente = "—". Use `conteudo` para cartões que não são um valor (ex.: contagens). */
  valor?: number | null;
  conteudo?: ReactNode;
  tipo?: "od" | "ed" | "saldo" | "neutro";
  /** De onde vem o número (ex.: "Soma das 12 apurações concluídas"). */
  legenda?: ReactNode;
  ajuda?: string;
  /** "kpi" (painel, 28 px) ou "destaque" (resultado da apuração, 32 px). */
  tamanho?: "kpi" | "destaque";
  /** Esqueleto no lugar do valor e da legenda. */
  carregando?: boolean;
  /** "cartao" (caixa própria) ou "plano" (sem caixa, dentro de um bloco que já tem superfície, como o resumo do painel). */
  aparencia?: "cartao" | "plano";
};

/** Cartão de total. O saldo sempre leva o aviso "Não é o ICMS a recolher". */
export function CartaoTotal({ rotulo, valor, conteudo, tipo = "neutro", legenda, ajuda, tamanho = "kpi", carregando = false, aparencia = "cartao" }: Props) {
  const vazio = conteudo === undefined && typeof valor !== "number";
  return (
    <section className="cartao-total" data-tipo={tipo} data-tamanho={tamanho} data-aparencia={aparencia} aria-label={rotulo}>
      <div className="cartao-total__rotulo">
        <span className="cartao-total__marcador" aria-hidden="true" />
        <span>{rotulo}</span>
        {ajuda && <AjudaPopover rotulo={rotulo} texto={ajuda} />}
      </div>
      {carregando ? (
        <div className="cartao-total__valor" aria-hidden="true">
          <span className="esqueleto cartao-total__esqueleto" />
        </div>
      ) : (
        <div className="cartao-total__valor" data-vazio={vazio || undefined}>
          {conteudo ?? formatarReais(valor)}
        </div>
      )}
      {tipo === "saldo" && <p className="cartao-total__aviso">{AVISO_SALDO}</p>}
      {legenda && !carregando && <p className="cartao-total__legenda">{legenda}</p>}
    </section>
  );
}
