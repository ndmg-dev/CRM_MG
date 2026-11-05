import { describe, expect, it } from "vitest";

import type { Pendencia, SugestaoPendencia } from "../../tipos";
import { buscar, contarGrupos, destacarDiferencas, grupoDe, grupoInicial } from "./pendenciasFila";

const sug = (nivel: "IDENTICO" | "PARECIDO"): SugestaoPendencia => ({ item_id: 1, descricao: "X", icms: "ST", nivel, similaridade: nivel === "IDENTICO" ? 1 : 0.9 });
const P = (id: number, extra: Partial<Pendencia> = {}, descricao = `PRODUTO ${id}`, ncm = "73181500"): Pendencia => ({
  id, descricao, ncm, cfop_exemplo: 5102, ocorrencias: 1, valor_total: 10, status: "ABERTA", tributacao_definida: null,
  resolvido_por: null, resolvido_em: null, criado_em: "2026-10-01T12:00:00Z", ...extra,
});

describe("grupos da fila", () => {
  it("idêntica e consistente = pode aceitar; parecida ou ambígua = conferir; nada = sem sugestão", () => {
    expect(grupoDe(P(1, { sugestoes: [sug("IDENTICO")], sugestao_aceitavel: sug("IDENTICO") }))).toBe("pode");
    expect(grupoDe(P(2, { sugestoes: [sug("PARECIDO")], sugestao_aceitavel: null }))).toBe("conferir");
    // idêntica mas NÃO aceitável (ex.: duas idênticas com tributações diferentes) também pede conferência
    expect(grupoDe(P(3, { sugestoes: [sug("IDENTICO")], sugestao_aceitavel: null }))).toBe("conferir");
    expect(grupoDe(P(4, { sugestoes: [] }))).toBe("sem");
    expect(grupoDe(P(5))).toBe("sem");
  });

  it("conta por grupo e começa pelo primeiro grupo com item, do mais seguro ao mais trabalhoso", () => {
    const itens = [P(1, { sugestoes: [sug("PARECIDO")] }), P(2), P(3)];
    const c = contarGrupos(itens);
    expect(c).toEqual({ pode: 0, conferir: 1, sem: 2 });
    expect(grupoInicial(c)).toBe("conferir");
    expect(grupoInicial({ pode: 1, conferir: 5, sem: 0 })).toBe("pode");
    expect(grupoInicial({ pode: 0, conferir: 0, sem: 0 })).toBe("pode");
  });
});

describe("diferenças entre o produto e o candidato", () => {
  it("marca só as palavras do candidato que o produto não tem", () => {
    const t = destacarDiferencas("MASSA ACRILICA BD 25KG SBRAS", "MASSA ACRILICA BD 20KG SBRAS");
    expect(t.filter((x) => x.difere).map((x) => x.texto)).toEqual(["25KG"]);
    expect(t.map((x) => x.texto).join(" ")).toBe("MASSA ACRILICA BD 25KG SBRAS");
  });

  it("ignora maiúsculas e acento; números diferentes contam como diferença", () => {
    expect(destacarDiferencas("Argamassa Cerâmica 20kg", "ARGAMASSA CERAMICA 20KG").some((x) => x.difere)).toBe(false);
    expect(destacarDiferencas("YALEN 13,5 KG", "YALEN 13 KG").filter((x) => x.difere).map((x) => x.texto)).toEqual(["13,5"]);
  });

  it("candidato idêntico não marca nada; espaços extras não criam trecho vazio", () => {
    expect(destacarDiferencas("TUBO  PVC", "TUBO PVC").map((x) => x.texto)).toEqual(["TUBO", "PVC"]);
    expect(destacarDiferencas("TUBO  PVC", "TUBO PVC").some((x) => x.difere)).toBe(false);
  });
});

describe("busca na página", () => {
  const itens = [P(1, {}, "CIMENTO CP II", "25232910"), P(2, {}, "ARGAMASSA CERÂMICA", "32141010")];
  it("acha por descrição (sem acento) ou NCM; vazio devolve tudo", () => {
    expect(buscar(itens, "ceramica").map((p) => p.id)).toEqual([2]);
    expect(buscar(itens, "2523").map((p) => p.id)).toEqual([1]);
    expect(buscar(itens, "  ").length).toBe(2);
    expect(buscar(itens, "inexistente")).toEqual([]);
  });
});
