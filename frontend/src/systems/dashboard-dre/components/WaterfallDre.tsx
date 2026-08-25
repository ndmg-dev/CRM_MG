"use client";

import { useMemo } from "react";
import { useIndice } from "./DatasetProvider";
import { Card, Eyebrow, Nota } from "./ui";
import {
  calcular,
  divSegura,
  moedaComMenos,
  percentual,
  waterfall,
  type DegrauWaterfall,
} from "../lib/metrics";
import { useFiltros } from "../lib/store";

/** Papel visual da linha — define o TOM, nunca o matiz (design-system.md §2). */
type Papel = "ancora" | "incremento" | "subtracao" | "resultado";

interface Barra extends DegrauWaterfall {
  av: number | null;
  papel: Papel;
}

const COR: Record<Papel, string> = {
  ancora: "var(--gold)",
  incremento: "var(--gold-soft)",
  subtracao: "var(--gold-dim)",
  resultado: "var(--gold)",
};

function papelDe(degrau: DegrauWaterfall): Papel {
  if (degrau.chave === "resultado") return "resultado";
  if (degrau.tipo === "subtotal") return "ancora";
  return degrau.valor < 0 ? "subtracao" : "incremento";
}

// geometria das linhas, em px — o conector precisa casar com estes valores
const ALTURA_LINHA = 28;
const RESPIRO_BARRA = 4;
const ESPACO_ENTRE_LINHAS = 6;

/**
 * Waterfall da DRE (spec §7.3) — elemento-assinatura.
 * Barras flutuantes em HTML/CSS posicionadas por porcentagem, em três colunas
 * fixas: rótulo · plotagem · valores. Nenhum número é escrito sobre a barra.
 */
export function WaterfallDre() {
  const indice = useIndice();
  const { escopo, meses } = useFiltros();

  const { barras, min, max } = useMemo(() => {
    const metricas = calcular(indice, escopo, meses);

    const barras: Barra[] = waterfall(metricas)
      // linhas zeradas no período só acrescentam ruído
      .filter((degrau) => degrau.valor !== 0)
      .map((degrau) => ({
        ...degrau,
        av: divSegura(degrau.valor, metricas.receitaBruta),
        papel: papelDe(degrau),
      }));

    const extremos = barras.flatMap((b) => [b.inicio, b.fim, 0]);
    return { barras, min: Math.min(...extremos), max: Math.max(...extremos) };
  }, [indice, escopo, meses]);

  const amplitude = max - min || 1;
  const pct = (v: number) => ((v - min) / amplitude) * 100;
  const zero = pct(0);

  return (
    <Card>
      <Eyebrow descricao="da receita bruta ao resultado do período">
        Cascata da DRE
      </Eyebrow>

      <div
        className="mt-5 flex flex-col"
        style={{ gap: `${ESPACO_ENTRE_LINHAS}px` }}
      >
        {barras.map((barra, i) => {
          const esquerda = Math.min(pct(barra.inicio), pct(barra.fim));
          const largura = Math.max(Math.abs(pct(barra.fim) - pct(barra.inicio)), 0.4);
          const cor =
            barra.papel === "resultado" && barra.valor < 0
              ? "var(--neg)"
              : COR[barra.papel];
          const ultima = i === barras.length - 1;

          return (
            <div
              key={barra.chave}
              className="grid grid-cols-[minmax(0,1fr)] items-center gap-1 sm:grid-cols-[168px_minmax(0,1fr)_148px] sm:gap-3"
            >
              {/* coluna 1 — rótulo */}
              <span
                className={`truncate text-[13px] ${
                  barra.tipo === "subtotal"
                    ? "font-medium text-text"
                    : "text-text-muted"
                }`}
                title={barra.rotulo}
              >
                {barra.rotulo}
              </span>

              {/* coluna 2 — plotagem */}
              <div
                className="relative rounded-sm bg-panel-2"
                style={{ height: `${ALTURA_LINHA}px` }}
              >
                <div
                  className="absolute inset-y-0 w-px bg-line-strong"
                  style={{ left: `${zero}%` }}
                  aria-hidden="true"
                />
                <div
                  className="absolute rounded-[3px]"
                  style={{
                    top: `${RESPIRO_BARRA}px`,
                    bottom: `${RESPIRO_BARRA}px`,
                    left: `${esquerda}%`,
                    width: `${largura}%`,
                    background: cor,
                  }}
                  role="img"
                  aria-label={`${barra.rotulo}: ${moedaComMenos(barra.valor)}`}
                />
                {/* conector: liga o saldo corrente ao início da próxima barra */}
                {!ultima && (
                  <div
                    className="absolute hidden w-px bg-line-strong sm:block"
                    style={{
                      left: `${pct(barra.fim)}%`,
                      top: `${ALTURA_LINHA - RESPIRO_BARRA}px`,
                      height: `${RESPIRO_BARRA + ESPACO_ENTRE_LINHAS + RESPIRO_BARRA}px`,
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* coluna 3 — valores, sempre à direita e tabulares */}
              <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-end sm:justify-center sm:gap-0.5">
                <span
                  className={`num text-[13px] leading-none ${
                    barra.tipo === "subtotal" ? "text-text" : "text-text-muted"
                  }`}
                >
                  {moedaComMenos(barra.valor)}
                </span>
                <span className="num text-[11px] leading-none text-text-faint">
                  {percentual(barra.av, 2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <Nota>
          Tom dourado indica direção: sólido nas âncoras (receita bruta, líquida e
          lucro bruto), claro no que soma, apagado no que subtrai. Percentuais são
          análise vertical sobre a receita bruta operacional (3.1.01 = 100%).
          Receita líquida é estrita (bruta − deduções); outras receitas
          operacionais entram como degrau próprio, e a cascata fecha exatamente no
          resultado da conta 3.
        </Nota>
      </div>
    </Card>
  );
}
