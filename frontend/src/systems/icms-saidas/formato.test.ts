import { describe, expect, it } from "vitest";

import {
  competenciaPorExtenso,
  formatarCompetencia,
  formatarData,
  formatarReais,
  formatarTamanho,
  lerCnpj,
  normalizarRazaoSocial,
  mascararCnpj,
  lerCompetencia,
  mesAnterior,
  rotulo,
  somarMeses,
} from "./formato";

// Intl usa espaço não separável entre "R$" e o número.
// eslint-disable-next-line no-irregular-whitespace -- o teste confere justamente o espaço não separável (NBSP) do Intl
const normalizar = (texto: string) => texto.replace(/ /g, " ");

describe("formatação", () => {
  it("formata R$ no padrão pt-BR", () => {
    expect(normalizar(formatarReais(6612.94))).toBe("R$ 6.612,94");
    expect(normalizar(formatarReais(31249.68))).toBe("R$ 31.249,68");
    expect(normalizar(formatarReais(-24636.74))).toBe("-R$ 24.636,74");
    expect(normalizar(formatarReais(0))).toBe("R$ 0,00");
    expect(formatarReais(null)).toBe("—");
  });

  it("exibe competência como MM/AAAA", () => {
    expect(formatarCompetencia("2026-08")).toBe("08/2026");
    expect(formatarCompetencia(undefined)).toBe("—");
  });

  it("formata datas em pt-BR", () => {
    expect(formatarData("2026-09-01")).toBe("01/09/2026");
    expect(formatarData("2026-09-15T15:30:00Z")).toBe("15/09/2026 12:30");
  });

  it("mascara o CNPJ enquanto se digita ou cola", () => {
    expect(mascararCnpj("12")).toBe("12");
    expect(mascararCnpj("123")).toBe("12.3");
    expect(mascararCnpj("123456")).toBe("12.345.6");
    expect(mascararCnpj("123456780")).toBe("12.345.678/0");
    expect(mascararCnpj("1234567800019")).toBe("12.345.678/0001-9");
    expect(mascararCnpj("12345678000195")).toBe("12.345.678/0001-95");
    expect(mascararCnpj("12.345.678/0001-95")).toBe("12.345.678/0001-95");
    expect(mascararCnpj("12345678000195999")).toBe("12.345.678/0001-95");
    expect(mascararCnpj("ab")).toBe("");
    expect(lerCnpj(mascararCnpj("12345678000195"))).toBe("12.345.678/0001-95");
  });

  it("lê CNPJ com 14 dígitos ou formatado; vazio é null", () => {
    expect(lerCnpj("12345678000195")).toBe("12345678000195");
    expect(lerCnpj(" 12.345.678/0001-95 ")).toBe("12.345.678/0001-95");
    expect(lerCnpj("")).toBeNull();
    expect(lerCnpj("   ")).toBeNull();
    expect(lerCnpj("123")).toBeUndefined();
    expect(lerCnpj("12.345.678/0001-9")).toBeUndefined();
    expect(lerCnpj("12345678/000195")).toBeUndefined();
    expect(lerCnpj("1234567800019a")).toBeUndefined();
  });

  it("calcula o mês anterior, inclusive na virada do ano", () => {
    expect(mesAnterior(new Date(2026, 9, 28))).toBe("2026-09");
    expect(mesAnterior(new Date(2026, 0, 5))).toBe("2025-12");
  });

  it("traduz códigos de situação", () => {
    expect(rotulo("CONCLUIDA_COM_PENDENCIAS")).toBe("Concluída com pendências");
    expect(rotulo("ALGO_NOVO")).toBe("Algo novo");
  });
});

describe("competência digitada", () => {
  it("aceita 092026, 9/2026 e 09/2026 e normaliza para AAAA-MM", () => {
    expect(lerCompetencia("092026")).toBe("2026-09");
    expect(lerCompetencia("9/2026")).toBe("2026-09");
    expect(lerCompetencia(" 09/2026 ")).toBe("2026-09");
    expect(formatarCompetencia(lerCompetencia("9/2026"))).toBe("09/2026");
  });

  it("recusa mês inválido ou formato estranho", () => {
    for (const texto of ["", "13/2026", "00/2026", "2026-09", "9/26", "setembro"]) expect(lerCompetencia(texto)).toBeNull();
  });

  it("soma meses atravessando o ano", () => {
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(somarMeses("2025-12", 1)).toBe("2026-01");
    expect(competenciaPorExtenso("2026-03")).toBe("março de 2026");
  });

  it("formata tamanho de arquivo", () => {
    expect(formatarTamanho(900)).toBe("900 B");
    expect(formatarTamanho(18 * 1024)).toBe("18 KB");
    expect(formatarTamanho(1.25 * 1024 * 1024)).toBe("1,3 MB");
  });
  it("razão social vai em maiúsculas, com acentos, sem espaços repetidos", () => {
    expect(normalizarRazaoSocial("  Sertão da  Construção ltda ")).toBe("SERTÃO DA CONSTRUÇÃO LTDA");
    expect(normalizarRazaoSocial("mendonça e macedo")).toBe("MENDONÇA E MACEDO");
    expect(normalizarRazaoSocial("   ")).toBe("");
  });
});
