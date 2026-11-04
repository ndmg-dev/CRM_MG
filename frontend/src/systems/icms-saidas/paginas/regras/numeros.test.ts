import { describe, expect, it } from "vitest";

import {
  fracaoParaPercentual,
  lerListaCst,
  lerListaNumeros,
  numeroParaTexto,
  percentualParaFracao,
  textoParaNumero,
} from "./numeros";

describe("percentuais das regras (fração do motor ⇄ % da tela, sem arredondar)", () => {
  it.each([
    [0.4293, "42,93"],
    [0.7333, "73,33"],
    [0.5833, "58,33"], // 58.33 / 100 em ponto flutuante dá 0.5832999999999999
    [0.2732, "27,32"],
    [0.205, "20,5"],
    [1, "100"],
    [0, "0"],
    [0.12, "12"],
    [0.70590001, "70,590001"],
    [0.0001, "0,01"],
    [0.00001, "0,001"],
  ])("%s → %s → volta igual", (fracao, texto) => {
    expect(fracaoParaPercentual(fracao)).toBe(texto);
    expect(percentualParaFracao(texto)).toBe(fracao);
  });

  it("aceita ponto, espaço e símbolo de %; vazio ou lixo vira null", () => {
    expect(percentualParaFracao(" 42.93 % ")).toBe(0.4293);
    expect(percentualParaFracao("")).toBeNull();
    expect(percentualParaFracao("abc")).toBeNull();
    expect(percentualParaFracao("1,2,3")).toBeNull();
    expect(fracaoParaPercentual(null)).toBe("");
  });

  it("não usa multiplicação de ponto flutuante", () => {
    expect(0.07 * 100).not.toBe(7); // 7.000000000000001: é o motivo de deslocar a vírgula no texto
    expect(fracaoParaPercentual(0.07)).toBe("7");
    expect(percentualParaFracao("7")).toBe(0.07);
  });
});

describe("números e listas", () => {
  it("tolerância e alíquotas em texto pt-BR", () => {
    expect(numeroParaTexto(0.05)).toBe("0,05");
    expect(numeroParaTexto(20.5)).toBe("20,5");
    expect(textoParaNumero("0,10")).toBe(0.1);
    expect(textoParaNumero("x")).toBeNull();
  });

  it("listas de alíquotas e de CST", () => {
    expect(lerListaNumeros("0; 4; 7; 12; 20,5")).toEqual([0, 4, 7, 12, 20.5]);
    expect(lerListaNumeros("")).toEqual([]);
    expect(lerListaNumeros("4; x")).toBeNull();
    expect(lerListaCst("60, 10")).toEqual(["60", "10"]);
    expect(lerListaCst("6")).toBeNull();
  });
});
