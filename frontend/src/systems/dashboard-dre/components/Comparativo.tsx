"use client";

import { useMemo, useState } from "react";
import { useIndice } from "./DatasetProvider";
import { Card, Eyebrow, Nota } from "./ui";
import { moeda, moedaCompacta, percentual, ranking, type LinhaRanking } from "../lib/metrics";
import { useFiltros } from "../lib/store";

type Coluna = {
  chave: string;
  rotulo: string;
  valor: (linha: LinhaRanking) => number | null;
  formatar: (linha: LinhaRanking) => string;
  colorirSinal?: boolean;
};

const COLUNAS: Coluna[] = [
  {
    chave: "receitaLiquida",
    rotulo: "Receita líquida",
    valor: (l) => l.metricas.receitaLiquida,
    formatar: (l) => moeda(l.metricas.receitaLiquida),
  },
  {
    chave: "lucroBruto",
    rotulo: "Lucro bruto",
    valor: (l) => l.metricas.lucroBruto,
    formatar: (l) => moeda(l.metricas.lucroBruto),
  },
  {
    chave: "margemBruta",
    rotulo: "Margem bruta",
    valor: (l) => l.metricas.margemBruta,
    formatar: (l) => percentual(l.metricas.margemBruta),
  },
  {
    chave: "resultado",
    rotulo: "Resultado",
    valor: (l) => l.metricas.resultado,
    formatar: (l) => moeda(l.metricas.resultado),
    colorirSinal: true,
  },
  {
    chave: "margemLiquida",
    rotulo: "Margem líquida",
    valor: (l) => l.metricas.margemLiquida,
    formatar: (l) => percentual(l.metricas.margemLiquida),
    colorirSinal: true,
  },
];

export function Comparativo() {
  const indice = useIndice();
  const { meses } = useFiltros();
  const [ordenarPor, setOrdenarPor] = useState("resultado");
  const [ascendente, setAscendente] = useState(false);

  const { lojas, grupos } = useMemo(() => ranking(indice, meses), [indice, meses]);

  const ordenadas = useMemo(() => {
    const coluna = COLUNAS.find((c) => c.chave === ordenarPor) ?? COLUNAS[3];
    return [...lojas].sort((a, b) => {
      const va = coluna.valor(a);
      const vb = coluna.valor(b);
      if (va === null) return 1;
      if (vb === null) return -1;
      return ascendente ? va - vb : vb - va;
    });
  }, [lojas, ordenarPor, ascendente]);

  const atipicas = lojas.filter((l) => l.estruturaAtipica);
  const maiorResultado = Math.max(
    ...lojas.map((l) => Math.abs(l.metricas.resultado)),
    1,
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Eyebrow descricao="só as lojas de varejo, no período selecionado — clique num cabeçalho para ordenar por ele">
          Ranking de lojas
        </Eyebrow>

        <div className="mt-4 -mx-1 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th className="px-2 py-2 text-left text-[11px] font-medium tracking-[.08em] text-text-muted uppercase">
                  Empresa
                </th>
                {COLUNAS.map((coluna) => (
                  <th
                    key={coluna.chave}
                    className="px-2 py-2 text-right"
                    aria-sort={
                      ordenarPor === coluna.chave
                        ? ascendente
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (ordenarPor === coluna.chave) setAscendente((v) => !v);
                        else {
                          setOrdenarPor(coluna.chave);
                          setAscendente(false);
                        }
                      }}
                      className={`text-[11px] font-medium tracking-[.08em] uppercase transition-colors ${
                        ordenarPor === coluna.chave
                          ? "text-gold"
                          : "text-text-muted hover:text-text"
                      }`}
                    >
                      {coluna.rotulo}
                      {ordenarPor === coluna.chave && (ascendente ? " ↑" : " ↓")}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((linha) => (
                <tr key={linha.codigo} className="border-b border-line last:border-0">
                  <td className="px-2 py-2.5">
                    <span className="text-text">{linha.codigo}</span>
                    {linha.estruturaAtipica && (
                      <span
                        title="Estrutura de despesa não-comparável com os pares"
                        className="ml-2 rounded border border-line-strong bg-gold-tint px-1.5 py-0.5 text-[10px] tracking-[.06em] text-gold uppercase"
                      >
                        estrutura atípica
                      </span>
                    )}
                  </td>
                  {COLUNAS.map((coluna) => {
                    const bruto = coluna.valor(linha);
                    const negativo = coluna.colorirSinal && bruto !== null && bruto < 0;
                    return (
                      <td
                        key={coluna.chave}
                        className={`num px-2 py-2.5 text-right ${
                          negativo ? "text-neg" : "text-text"
                        }`}
                      >
                        {coluna.formatar(linha)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {grupos.length > 0 && (
              <tfoot>
                {grupos.map((consolidado) => (
                  <tr key={consolidado.codigo} className="border-t border-line-strong">
                    <td className="px-2 py-2.5 text-text-muted">
                      Atacado
                      <span className="ml-2 text-[11px] text-text-faint">
                        · {consolidado.codigo} · outro negócio, fora do ranking
                      </span>
                    </td>
                    {COLUNAS.map((coluna) => {
                      const bruto = coluna.valor(consolidado);
                      const negativo = coluna.colorirSinal && bruto !== null && bruto < 0;
                      return (
                        <td
                          key={coluna.chave}
                          className={`num px-2 py-2.5 text-right ${
                            negativo ? "text-neg" : "text-text-muted"
                          }`}
                        >
                          {coluna.formatar(consolidado)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-3">
          {atipicas.length > 0 && (
            <Nota>
              🔴{" "}
              {atipicas.map((l) => l.codigo).join(", ")} tem estrutura de despesa
              operacional fora do padrão dos pares (
              {atipicas
                .map((l) => `${l.codigo}: ${percentual(l.pesoDespesaOp)} da RL`)
                .join(" · ")}
              ). Provável diferença de alocação de custos — comparar margens com as
              demais leva a conclusão errada.
            </Nota>
          )}
          <Nota>
            O ranking compara apenas as unidades de <strong className="font-normal text-text-muted">varejo</strong>,
            que fazem a mesma coisa. O atacado aparece no rodapé sem posição: ele
            vende só por convênio, então margem e estrutura de custo dele não se
            comparam com as das lojas. Nenhuma unidade contém outra — somar todas
            dá o grupo inteiro, sem dupla contagem.
          </Nota>
        </div>
      </Card>

      <Card>
        <Eyebrow descricao="resultado por empresa no período">Resultado</Eyebrow>
        <div className="mt-5 space-y-2.5">
          {ordenadas.map((linha) => {
            const largura = (Math.abs(linha.metricas.resultado) / maiorResultado) * 100;
            const negativo = linha.metricas.resultado < 0;
            return (
              <div
                key={linha.codigo}
                className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3"
              >
                <span className="text-[13px] text-text-muted">{linha.codigo}</span>
                <div className="relative h-6">
                  <div
                    className="absolute inset-y-0 left-1/2 w-px bg-line-strong"
                    aria-hidden="true"
                  />
                  <div
                    className="absolute inset-y-0.5 rounded-[3px]"
                    style={{
                      width: `${largura / 2}%`,
                      background: negativo ? "var(--neg)" : "var(--gold)",
                      ...(negativo
                        ? { right: "50%" }
                        : { left: "50%" }),
                    }}
                    role="img"
                    aria-label={`${linha.codigo}: ${moeda(linha.metricas.resultado)}`}
                  />
                </div>
                <span
                  className={`num w-28 text-right text-[13px] ${
                    negativo ? "text-neg" : "text-text"
                  }`}
                >
                  {moedaCompacta(linha.metricas.resultado)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
