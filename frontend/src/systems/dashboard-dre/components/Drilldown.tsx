"use client";

import { useMemo, useState } from "react";
import { useIndice } from "./DatasetProvider";
import { Card, Eyebrow, Nota } from "./ui";
import {
  CONTAS,
  analiseHorizontal,
  analiseVertical,
  divSegura,
  filhosDe,
  moeda,
  nomeMes,
  percentual,
  percentualComSinal,
  serie,
  valor,
  type Indice,
} from "../lib/metrics";
import { useFiltros } from "../lib/store";
import type { Escopo } from "../lib/types";

/** Um mês da linha: valor + suas análises, como as colunas pares da planilha. */
interface CelulaMes {
  mes: number;
  valor: number;
  /** AV do mês: conta / receita bruta operacional DAQUELE mês */
  av: number | null;
  /** AH do mês: variação sobre o mês selecionado anterior */
  ah: number | null;
}

interface Linha {
  classificacao: string;
  descricao: string;
  tipo: "TT" | "NN";
  profundidade: number;
  temFilhos: boolean;
  expandido: boolean;
  celulas: CelulaMes[];
  total: number;
  av: number | null;
  ah: number | null;
}

function montarLinhas(
  indice: Indice,
  escopo: Escopo,
  meses: number[],
  /** receita bruta de cada mês selecionado — base da AV mensal (100%) */
  baseAv: number[],
  abertos: Set<string>,
  raiz: string,
  profundidade = 0,
): Linha[] {
  const conta = indice.contasPorClassificacao.get(raiz);
  if (!conta) return [];

  const valores = serie(indice, escopo, raiz, meses);
  const filhos = filhosDe(indice, raiz);
  const expandido = abertos.has(raiz);

  const celulas: CelulaMes[] = valores.map((v, i) => ({
    mes: meses[i],
    valor: v,
    av: divSegura(v, baseAv[i]),
    ah: i > 0 ? analiseHorizontal(v, valores[i - 1]) : null,
  }));

  const linha: Linha = {
    classificacao: raiz,
    descricao: conta.descricao,
    tipo: conta.tipo,
    profundidade,
    temFilhos: filhos.length > 0,
    expandido,
    celulas,
    total: valor(indice, escopo, raiz, meses),
    av: analiseVertical(indice, escopo, raiz, meses),
    ah:
      valores.length > 1
        ? analiseHorizontal(valores[valores.length - 1], valores[valores.length - 2])
        : null,
  };

  if (!expandido) return [linha];
  return [
    linha,
    ...filhos.flatMap((filho) =>
      montarLinhas(
        indice,
        escopo,
        meses,
        baseAv,
        abertos,
        filho.classificacao,
        profundidade + 1,
      ),
    ),
  ];
}

export function Drilldown() {
  const indice = useIndice();
  const { escopo, meses } = useFiltros();
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(["3", "3.1", "3.2", "3.3"]),
  );
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState(true);

  const linhas = useMemo(() => {
    // base da AV mensal: receita bruta operacional de cada mês selecionado
    const baseAv = serie(indice, escopo, CONTAS.receitaBruta, meses);
    return montarLinhas(indice, escopo, meses, baseAv, abertos, "3");
  }, [indice, escopo, meses, abertos]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter(
      (linha) =>
        linha.descricao.toLowerCase().includes(termo) ||
        linha.classificacao.includes(termo),
    );
  }, [linhas, busca]);

  const alternar = (classificacao: string) =>
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(classificacao)) proximo.delete(classificacao);
      else proximo.add(classificacao);
      return proximo;
    });

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Eyebrow descricao="árvore da DRE com análise vertical e horizontal">
          Drilldown por conta
        </Eyebrow>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDetalhe((v) => !v)}
            aria-pressed={detalhe}
            title="Mostrar AV e AH dentro de cada mês"
            className={`rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
              detalhe
                ? "bg-gold-tint text-gold"
                : "text-text-muted hover:bg-panel-2 hover:text-text"
            }`}
          >
            AV/AH por mês
          </button>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar conta…"
            aria-label="Filtrar conta"
            className="w-52 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-[12px] text-text placeholder:text-text-faint"
          />
        </div>
      </div>

      <div className="mt-4 -mx-1 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 bg-panel px-2 py-2 text-left text-[11px] font-medium tracking-[.08em] text-text-muted uppercase">
                Conta
              </th>
              {meses.map((mes) => (
                <th
                  key={mes}
                  className="px-2 py-2 text-right text-[11px] font-medium tracking-[.08em] text-text-muted uppercase"
                >
                  {nomeMes(mes)}
                  {detalhe && (
                    <span className="block text-[9px] font-normal tracking-normal text-text-faint normal-case">
                      valor · AV · AH
                    </span>
                  )}
                </th>
              ))}
              <th className="px-2 py-2 text-right text-[11px] font-medium tracking-[.08em] text-text-muted uppercase">
                Período
              </th>
              <th className="px-2 py-2 text-right text-[11px] font-medium tracking-[.08em] text-text-muted uppercase">
                AV
              </th>
              <th className="px-2 py-2 text-right text-[11px] font-medium tracking-[.08em] text-text-muted uppercase">
                AH
              </th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((linha) => (
              <tr
                key={linha.classificacao}
                className="border-b border-line last:border-0 hover:bg-panel-2"
              >
                <td className="sticky left-0 bg-panel px-2 py-1.5">
                  <span
                    className="flex items-center gap-1.5"
                    style={{ paddingLeft: `${linha.profundidade * 14}px` }}
                  >
                    {linha.temFilhos ? (
                      <button
                        type="button"
                        onClick={() => alternar(linha.classificacao)}
                        aria-expanded={linha.expandido}
                        aria-label={`${linha.expandido ? "Recolher" : "Expandir"} ${linha.descricao}`}
                        className="w-3 shrink-0 text-text-faint hover:text-gold"
                      >
                        {linha.expandido ? "−" : "+"}
                      </button>
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        linha.tipo === "TT" ? "text-text" : "text-text-muted"
                      }`}
                      title={`${linha.classificacao} · ${linha.descricao}`}
                    >
                      {linha.descricao || linha.classificacao}
                    </span>
                    <span className="num shrink-0 text-[10px] text-text-faint">
                      {linha.classificacao}
                    </span>
                  </span>
                </td>
                {linha.celulas.map((celula) => (
                  <td
                    key={celula.mes}
                    className={`num px-2 py-1.5 text-right align-top ${
                      celula.valor < 0 ? "text-text-muted" : "text-text"
                    }`}
                  >
                    {moeda(celula.valor)}
                    {detalhe && (
                      // AV e AH do próprio mês, logo abaixo do valor — mesma
                      // leitura das colunas pares da planilha, sem tirar o
                      // valor do lugar.
                      <span className="mt-0.5 flex items-baseline justify-end gap-1.5 leading-none">
                        <span
                          className="text-[10px] text-text-faint"
                          title="AV — participação na receita bruta do mês"
                        >
                          {percentual(celula.av, 2)}
                        </span>
                        <span
                          className={`text-[10px] ${
                            celula.ah === null
                              ? "text-text-faint"
                              : celula.ah >= 0
                                ? "text-pos"
                                : "text-neg"
                          }`}
                          title="AH — variação sobre o mês selecionado anterior"
                        >
                          {percentualComSinal(celula.ah)}
                        </span>
                      </span>
                    )}
                  </td>
                ))}
                <td
                  className={`num px-2 py-1.5 text-right ${
                    linha.tipo === "TT" ? "font-medium text-text" : "text-text-muted"
                  }`}
                >
                  {moeda(linha.total)}
                </td>
                <td className="num px-2 py-1.5 text-right text-text-faint">
                  {percentual(linha.av)}
                </td>
                <td
                  className={`num px-2 py-1.5 text-right ${
                    linha.ah === null
                      ? "text-text-faint"
                      : linha.ah >= 0
                        ? "text-pos"
                        : "text-neg"
                  }`}
                >
                  {percentualComSinal(linha.ah)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <Nota>
          Dentro de cada mês: valor, <strong className="font-normal text-text-faint">AV</strong> sobre a
          receita bruta operacional daquele mês (3.1.01 = 100%) e{" "}
          <strong className="font-normal text-text-faint">AH</strong> sobre o mês selecionado
          anterior. As colunas AV e AH do fim da tabela são as do período
          acumulado. Contas em tom mais claro são totalizadoras (TT); as demais
          são analíticas (NN).
        </Nota>
      </div>
    </Card>
  );
}
