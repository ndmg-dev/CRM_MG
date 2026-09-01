"use client";

import { useMemo, useState } from "react";
import { useIndice } from "./DatasetProvider";
import { InsightCard } from "./InsightCard";
import { Card, Eyebrow, Nota } from "./ui";
import { gerarInsights, type Severidade } from "../lib/insights";
import { useFiltros } from "../lib/store";
import { useAnotacoes } from "../lib/anotacoes/useAnotacoes";
import type { StatusAnotacao } from "../lib/anotacoes/tipos";

const SEVERIDADES: { id: Severidade; rotulo: string; cor: string }[] = [
  { id: "critico", rotulo: "crítico", cor: "var(--neg)" },
  { id: "alerta", rotulo: "alerta", cor: "var(--gold)" },
  { id: "info", rotulo: "info", cor: "var(--text-muted)" },
];

export function Insights() {
  const indice = useIndice();
  const { escopo, meses } = useFiltros();
  const anot = useAnotacoes();
  const [mostrarDescartados, setMostrarDescartados] = useState(false);

  const insights = useMemo(
    () => gerarInsights(indice, escopo, meses),
    [indice, escopo, meses],
  );

  const statusDe = (chave: string): StatusAnotacao =>
    anot.anotacaoDe(chave)?.status ?? "em_aberto";

  const visiveis = mostrarDescartados
    ? insights
    : insights.filter((i) => statusDe(i.chave) !== "descartado");

  const descartados = insights.length - visiveis.length;

  // A contagem reflete o que está aberto — card descartado não conta como alerta.
  const contagem = insights.reduce<Record<string, number>>((acc, insight) => {
    if (statusDe(insight.chave) === "descartado") return acc;
    acc[insight.severidade] = (acc[insight.severidade] ?? 0) + 1;
    return acc;
  }, {});

  const resolvidos = insights.filter(
    (i) => statusDe(i.chave) === "verificado",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Eyebrow descricao="regras automáticas sobre o escopo e o período selecionados">
          Insights
        </Eyebrow>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          {SEVERIDADES.map((s) => (
            <span key={s.id} className="flex items-baseline gap-1.5">
              <span className="num text-[22px] font-semibold" style={{ color: s.cor }}>
                {contagem[s.id] ?? 0}
              </span>
              <span className="text-[11px] tracking-[.08em] text-text-muted uppercase">
                {s.rotulo}
              </span>
            </span>
          ))}
          {resolvidos > 0 && (
            <span className="flex items-baseline gap-1.5">
              <span className="num text-[22px] font-semibold text-pos">{resolvidos}</span>
              <span className="text-[11px] tracking-[.08em] text-text-muted uppercase">
                verificado
              </span>
            </span>
          )}
          {descartados > 0 && (
            <button
              type="button"
              onClick={() => setMostrarDescartados(true)}
              className="ml-auto text-[12px] text-text-faint hover:text-gold"
            >
              mostrar {descartados} descartado{descartados > 1 ? "s" : ""}
            </button>
          )}
          {mostrarDescartados && (
            <button
              type="button"
              onClick={() => setMostrarDescartados(false)}
              className="ml-auto text-[12px] text-text-faint hover:text-gold"
            >
              ocultar descartados
            </button>
          )}
        </div>

        {(anot.aviso || anot.erro || anot.carregando) && (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 border-t border-line pt-3">
            <Nota>
              {anot.carregando
                ? "Carregando anotações…"
                : (anot.erro ?? anot.aviso)}
              {!anot.carregando && !anot.persistencia && (
                <>
                  {" "}
                  Os cards seguem visíveis normalmente — só a curadoria está
                  indisponível.
                </>
              )}
            </Nota>
            {anot.erro && !anot.carregando && (
              <button
                type="button"
                onClick={anot.recarregar}
                className="text-[11px] text-gold hover:underline"
              >
                tentar novamente
              </button>
            )}
          </div>
        )}
      </Card>

      {visiveis.length === 0 ? (
        <Card>
          <Nota>
            {insights.length === 0
              ? "Nenhuma regra disparou para este escopo e período. Isso não significa ausência de problema — significa que os padrões cobertos pelas regras da spec §8 não apareceram aqui."
              : "Todos os achados deste escopo foram descartados."}
          </Nota>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visiveis.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              anotacao={anot.anotacaoDe(insight.chave)}
              editavel={anot.persistencia}
              salvando={anot.salvando === insight.chave}
              onSalvar={anot.salvar}
              onLimpar={anot.limpar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
