import { describe, expect, it } from "vitest";

import type { ProblemasLote } from "../../tipos";
import { chaveConflito, contarEscolhidos, escolhasIniciais, IGNORAR, montarDecisoes, valorCategoria, type Escolhas } from "./correcao";
import { PROBLEMAS } from "./correcao.fixtures";

const vazias = (): Escolhas => escolhasIniciais(PROBLEMAS);

describe("correção da importação – decisões", () => {
  it("sem nenhuma escolha não há decisão (nada é presumido)", () => {
    expect(montarDecisoes(PROBLEMAS, vazias())).toEqual([]);
    expect(contarEscolhidos(PROBLEMAS, vazias())).toBe(0);
  });

  it("monta o conjunto completo com os 5 tipos de decisão", () => {
    const e = vazias();
    e.categorias["ST - MONO"] = valorCategoria("ST");
    e.categorias["RBC 70,59%"] = IGNORAR;
    e.linhas[6] = { ignorar: false, valor: "  PRODUTO 5  " };
    e.linhas[7] = { ignorar: true, valor: "" };
    e.conflitos[chaveConflito("PRODUTO 7", "39173900")] = "ST";
    expect(montarDecisoes(PROBLEMAS, e)).toEqual([
      { tipo: "MAPEAR_CATEGORIA", texto: "ST - MONO", categoria: "ST" },
      { tipo: "IGNORAR_CATEGORIA", texto: "RBC 70,59%" },
      { tipo: "CORRIGIR_LINHA", linha: 6, descricao: "PRODUTO 5" }, // só o campo que faltava, sem espaços nas pontas
      { tipo: "IGNORAR_LINHA", linha: 7 },
      { tipo: "ESCOLHER_CONFLITO", descricao: "PRODUTO 7", ncm: "39173900", categoria: "ST" },
    ]);
  });

  it("a correção vai no campo certo (NCM, não descrição) e linha em branco não vira decisão", () => {
    const e = vazias();
    e.linhas[7] = { ignorar: false, valor: "39173900" };
    e.linhas[6] = { ignorar: false, valor: "   " };
    expect(montarDecisoes(PROBLEMAS, e)).toEqual([{ tipo: "CORRIGIR_LINHA", linha: 7, ncm: "39173900" }]);
  });

  it("as decisões gravadas voltam como escolhas e não levam 'por' nem 'em' no reenvio", () => {
    const gravado: ProblemasLote = {
      ...PROBLEMAS,
      categorias: [
        { ...PROBLEMAS.categorias[0], resolvido: true, decisao: { tipo: "MAPEAR_CATEGORIA", texto: "ST - MONO", categoria: "ST", por: "web:ana", em: "2026-11-03T12:00:00Z" } },
        { ...PROBLEMAS.categorias[1], resolvido: true, decisao: { tipo: "IGNORAR_CATEGORIA", texto: "RBC 70,59%", por: "web:ana", em: "x" } },
      ],
      linhas_invalidas: [
        { ...PROBLEMAS.linhas_invalidas[0], resolvido: true, decisao: { tipo: "CORRIGIR_LINHA", linha: 6, descricao: "PRODUTO 5", por: "web:ana", em: "x" } },
        { ...PROBLEMAS.linhas_invalidas[1], resolvido: true, decisao: { tipo: "IGNORAR_LINHA", linha: 7, por: "web:ana", em: "x" } },
      ],
      conflitos: [{ ...PROBLEMAS.conflitos[0], resolvido: true, decisao: { tipo: "ESCOLHER_CONFLITO", descricao: "PRODUTO 7", ncm: "39173900", categoria: "ST", por: "web:ana", em: "x" } }],
    };
    const e = escolhasIniciais(gravado);
    expect(e.categorias).toEqual({ "ST - MONO": "cat:ST", "RBC 70,59%": IGNORAR });
    expect(e.linhas[6]).toEqual({ ignorar: false, valor: "PRODUTO 5" });
    expect(e.linhas[7]).toEqual({ ignorar: true, valor: "" });
    const decisoes = montarDecisoes(gravado, e);
    expect(decisoes).toHaveLength(5);
    expect(JSON.stringify(decisoes)).not.toMatch(/"por"|"em"/);
  });

  it("decisão que o motor desconsiderou (sem problema correspondente) não é reenviada", () => {
    const e = vazias();
    e.categorias["NÃO EXISTE MAIS"] = valorCategoria("ST");
    e.linhas[999] = { ignorar: true, valor: "" };
    expect(montarDecisoes(PROBLEMAS, e)).toEqual([]);
  });
});
