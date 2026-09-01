"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useIndice } from "./DatasetProvider";
import { Card, Eyebrow, Nota } from "./ui";
import {
  composicao,
  mixRecebimento,
  moeda,
  percentual,
  quebraDespesas,
} from "../lib/metrics";
import { useFiltros } from "../lib/store";

/**
 * Tons da família dourada para séries categóricas — variação de tonalidade e
 * opacidade, nunca de matiz (design-system.md §2).
 */
function tomDourado(indice: number, total: number): string {
  const passo = total <= 1 ? 0 : indice / (total - 1);
  const opacidade = 1 - passo * 0.72;
  return `color-mix(in srgb, var(--gold-soft) ${(opacidade * 100).toFixed(0)}%, var(--panel))`;
}

function MixRecebimento() {
  const indice = useIndice();
  const { escopo, meses } = useFiltros();

  const itens = useMemo(
    () => mixRecebimento(indice, escopo, meses),
    [indice, escopo, meses],
  );
  const total = itens.reduce((soma, item) => soma + item.valor, 0);
  const dominante = itens.find(
    (item) => item.participacao !== null && item.participacao > 0.5,
  );

  return (
    <Card>
      <Eyebrow descricao="participação de cada meio na venda de mercadorias">
        Mix de recebimento
      </Eyebrow>

      <div className="mt-4 flex flex-col items-center gap-6 lg:flex-row">
        <div className="h-56 w-full max-w-[220px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={itens}
                dataKey="valor"
                nameKey="descricao"
                innerRadius="62%"
                outerRadius="96%"
                paddingAngle={1}
                stroke="var(--panel)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {itens.map((item, i) => (
                  <Cell key={item.classificacao} fill={tomDourado(i, itens.length)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--text-muted)" }}
                itemStyle={{ color: "var(--text)" }}
                formatter={(v, nome) => [
                  typeof v === "number" ? moeda(v) : "—",
                  String(nome),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full min-w-0 flex-1">
          <table className="w-full text-[13px]">
            <tbody>
              {itens.map((item, i) => (
                <tr key={item.classificacao} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{ background: tomDourado(i, itens.length) }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-text-muted">{item.descricao}</span>
                    </span>
                  </td>
                  <td className="num py-1.5 text-right text-text">{moeda(item.valor)}</td>
                  <td className="num w-16 py-1.5 text-right text-text-faint">
                    {percentual(item.participacao)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-1.5 text-[11px] tracking-[.08em] text-text-muted uppercase">
                  Total
                </td>
                <td className="num py-1.5 text-right text-text">{moeda(total)}</td>
                <td className="num py-1.5 text-right text-text-faint">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {dominante && (
        <div className="mt-3 border-t border-line pt-3">
          <Nota>
            {dominante.descricao} concentra {percentual(dominante.participacao)} da
            venda — acima de 50% num único meio, o que pesa em custo de adquirência e
            prazo de recebimento.
          </Nota>
        </div>
      )}
    </Card>
  );
}

function QuebraDespesas() {
  const indice = useIndice();
  const { escopo, meses } = useFiltros();
  const [aberto, setAberto] = useState<string | null>(null);

  const itens = useMemo(
    () => quebraDespesas(indice, escopo, meses),
    [indice, escopo, meses],
  );
  const maior = Math.max(...itens.map((item) => Math.abs(item.valor)), 1);

  const analiticas = useMemo(
    () => (aberto ? composicao(indice, escopo, aberto, meses) : []),
    [indice, escopo, aberto, meses],
  );

  return (
    <Card>
      <Eyebrow descricao="subgrupos de despesa operacional — clique para abrir as analíticas">
        Quebra de despesas
      </Eyebrow>

      <div className="mt-4 space-y-1">
        {itens.map((item) => {
          const expandido = aberto === item.classificacao;
          return (
            <div key={item.classificacao}>
              <button
                type="button"
                onClick={() => setAberto(expandido ? null : item.classificacao)}
                aria-expanded={expandido}
                disabled={!item.temFilhos}
                className="grid w-full grid-cols-[minmax(0,1fr)] items-center gap-1 rounded-md px-1 py-1 text-left transition-colors hover:bg-panel-2 disabled:hover:bg-transparent sm:grid-cols-[210px_minmax(0,1fr)_150px] sm:gap-3"
              >
                <span className="truncate text-[13px] text-text-muted">
                  {item.temFilhos && (
                    <span className="mr-1 inline-block text-text-faint">
                      {expandido ? "−" : "+"}
                    </span>
                  )}
                  {item.descricao}
                </span>
                <span className="relative block h-6 rounded-sm bg-panel-2">
                  <span
                    className="absolute inset-y-1 left-0 rounded-[3px]"
                    style={{
                      width: `${(Math.abs(item.valor) / maior) * 100}%`,
                      background: expandido ? "var(--gold)" : "var(--gold-deep)",
                    }}
                  />
                </span>
                <span className="flex items-baseline justify-between gap-2 sm:justify-end">
                  <span className="num text-[13px] text-text">{moeda(item.valor)}</span>
                  <span className="num w-12 text-right text-[11px] text-text-faint">
                    {percentual(item.participacao, 0)}
                  </span>
                </span>
              </button>

              {expandido && (
                <div className="mt-1 mb-2 ml-4 border-l border-line pl-4">
                  {analiticas.length === 0 ? (
                    <Nota>Sem lançamentos analíticos no período selecionado.</Nota>
                  ) : (
                    analiticas.map((analitica) => (
                      <div
                        key={analitica.classificacao}
                        className="flex items-baseline justify-between gap-3 py-1"
                      >
                        <span className="truncate text-[12px] text-text-muted">
                          {analitica.descricao}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-3">
                          <span className="num text-[12px] text-text">
                            {moeda(analitica.valor)}
                          </span>
                          <span className="num w-12 text-right text-[11px] text-text-faint">
                            {percentual(analitica.participacao, 0)}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <Nota>
          Percentuais são a participação de cada subgrupo no total de despesas
          operacionais (3.3). Valores negativos porque despesa já vem negativa do
          balancete.
        </Nota>
      </div>
    </Card>
  );
}

export function Composicao() {
  return (
    <div className="flex flex-col gap-4">
      <MixRecebimento />
      <QuebraDespesas />
    </div>
  );
}
