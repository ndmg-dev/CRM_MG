import { describe, expect, it } from "vitest";

import type { Pendencia, SugestaoPendencia } from "../../tipos";
import type { ResultadoResolucao } from "../../tipos";
import { partir, RESULTADO_VAZIO, resolucoesComTributacao, resumirResolucao, somarResultados, TAMANHO_LOTE } from "./pendenciasLote";

const sug = (nivel: "IDENTICO" | "PARECIDO", icms = "ST"): SugestaoPendencia => ({ item_id: 1, descricao: "X", icms, nivel, similaridade: nivel === "IDENTICO" ? 1 : 0.8 });
const pend = (id: number, extra: Partial<Pendencia> = {}): Pendencia => ({
  id, descricao: `P${id}`, ncm: "73181500", cfop_exemplo: 5102, ocorrencias: 1, valor_total: 10, status: "ABERTA", tributacao_definida: null,
  resolvido_por: null, resolvido_em: null, criado_em: "2026-11-03T12:00:00Z", ...extra,
});
const LISTA = [
  pend(1, { sugestoes: [sug("IDENTICO", "ST")], sugestao_aceitavel: sug("IDENTICO", "ST") }),
  pend(2, { sugestoes: [sug("PARECIDO")], sugestao_aceitavel: null }),
  pend(3, { sugestoes: [], sugestao_aceitavel: null }),
  pend(4, { sugestoes: [sug("IDENTICO", "NORMAL")], sugestao_aceitavel: sug("IDENTICO", "NORMAL") }),
  pend(5, { status: "RESOLVIDA", sugestao_aceitavel: sug("IDENTICO") }),
];

describe("pendências em lote", () => {
  it("tributação escolhida vale para todas as selecionadas abertas, mesmo parecidas ou sem sugestão", () => {
    expect(resolucoesComTributacao(LISTA, new Set([2, 3, 5]), "RBC 42,93% / 73,33%")).toEqual([
      { pendencia_id: 2, tributacao: "RBC 42,93% / 73,33%" },
      { pendencia_id: 3, tributacao: "RBC 42,93% / 73,33%" },
    ]); // a 5 já está resolvida
    expect(resolucoesComTributacao(LISTA, new Set([1]), "")).toEqual([]); // sem tributação escolhida não envia nada
  });

  it("parte o envio em blocos de no máximo 400 (teto do corpo do BFF)", () => {
    expect(TAMANHO_LOTE).toBe(400);
    const cem = Array.from({ length: 450 }, (_, i) => i);
    expect(partir(cem).map((p) => p.length)).toEqual([400, 50]);
    expect(partir([])).toEqual([]);
    expect(partir([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });
});

const R = (extra: Partial<ResultadoResolucao>): ResultadoResolucao => ({ ...RESULTADO_VAZIO, ...extra });

describe("mensagem do resultado (o que de fato aconteceu)", () => {
  it("só cadastradas", () => {
    expect(resumirResolucao(R({ resolvidas: 2, adicionadas: 2 }))).toBe("2 pendências resolvidas: 2 cadastradas na memória.");
    expect(resumirResolucao(R({ resolvidas: 1, adicionadas: 1 }))).toBe("1 pendência resolvida: 1 cadastrada na memória.");
  });

  it("item que já estava na memória é dito como MANTIDO, e o sobrescrito como sobrescrito", () => {
    expect(resumirResolucao(R({ resolvidas: 5, adicionadas: 3, mantidas: 2 }))).toBe(
      "5 pendências resolvidas: 3 cadastradas na memória; 2 já estavam na memória e foram mantidas como estão.",
    );
    expect(resumirResolucao(R({ resolvidas: 1, mantidas: 1 }))).toBe("1 pendência resolvida: 1 já estava na memória e foi mantida como está.");
    expect(resumirResolucao(R({ resolvidas: 4, adicionadas: 3, sobrescritas: 1 }))).toBe("4 pendências resolvidas: 3 cadastradas na memória; 1 sobrescrita.");
  });

  it("pendência já tratada não é tocada e, se foi só isso, diz que nada precisou ser resolvido", () => {
    expect(resumirResolucao(R({ resolvidas: 1, adicionadas: 1, ja_tratadas: 2 }))).toBe(
      "1 pendência resolvida: 1 cadastrada na memória; 2 já tinham sido tratadas e não foram tocadas.",
    );
    expect(resumirResolucao(R({ ja_tratadas: 3 }))).toBe("Nenhuma pendência precisou ser resolvida: 3 já tinham sido tratadas e não foram tocadas.");
    expect(resumirResolucao(R({}))).toBe("0 pendências resolvidas.");
  });

  it("soma os blocos de um envio", () => {
    const soma = somarResultados(R({ resolvidas: 400, adicionadas: 399, mantidas: 1, lote_id: "a" }), R({ resolvidas: 50, adicionadas: 50, lote_id: null }));
    expect(soma).toEqual({ resolvidas: 450, adicionadas: 449, sobrescritas: 0, mantidas: 1, ja_tratadas: 0, lote_id: "a" });
  });
});
