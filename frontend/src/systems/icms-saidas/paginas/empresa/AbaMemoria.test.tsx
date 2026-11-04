// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { agir, desmontarTudo, enviarFormulario, escolherArquivo, montar, respostaJson } from "../../testes/dom";
import { formatarCompetencia, mesAtual } from "../../formato";
import type { Lote } from "../../tipos";
import { EnviarPlanilha, vigenciaDaDiferenca, vigenciaDoLote } from "./AbaMemoria";

const chamadas: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
  chamadas.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return respostaJson({ id: "l1" });
    }),
  );
});

afterEach(() => {
  desmontarTudo();
  vi.unstubAllGlobals();
});

/** Campo MM/AAAA da "Mudança a partir de" (rotulado por um <label> oculto). */
function mesDaMudanca(raiz: HTMLElement) {
  const rotulo = [...raiz.querySelectorAll("label")].find((l) => l.textContent === "Mês/ano de início da mudança")!;
  return document.getElementById(rotulo.htmlFor) as HTMLInputElement;
}

async function prepararEnvio() {
  const aoEnviar = vi.fn();
  const raiz = await montar(<EnviarPlanilha base="/api/empresas/0001/memoria" aoEnviar={aoEnviar} />);
  const campo = raiz.querySelector<HTMLInputElement>('input[type="file"]')!;
  await agir(() => escolherArquivo(campo, new File(["x"], "memoria.xlsx")));
  return { raiz, aoEnviar };
}

describe("Enviar planilha da memória", () => {
  it("padrão é correção de cadastro e envia o lote SEM vigencia_inicio", async () => {
    const { raiz, aoEnviar } = await prepararEnvio();
    const correcao = raiz.querySelector<HTMLInputElement>('input[type="radio"][value="correcao"]')!;
    expect(correcao.checked).toBe(true);
    expect(raiz.querySelector('input[type="month"]')).toBeNull();
    expect(mesDaMudanca(raiz).disabled).toBe(true);

    await agir(() => enviarFormulario(raiz.querySelector("form")!));
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("/api/v1/icms-saidas/empresas/0001/memoria/lotes");
    const corpo = chamadas[0].init.body as FormData;
    expect(corpo.get("tipo")).toBe("PARCIAL");
    expect(corpo.has("vigencia_inicio")).toBe(false);
    expect(aoEnviar).toHaveBeenCalledOnce();
  });

  it("na mudança a partir de um mês, envia vigencia_inicio com dia 1", async () => {
    const { raiz } = await prepararEnvio();
    await agir(() => raiz.querySelector<HTMLInputElement>('input[type="radio"][value="COMPLETA"]')!.click());
    await agir(() => raiz.querySelector<HTMLInputElement>('input[type="radio"][value="mudanca"]')!.click());
    const mes = mesDaMudanca(raiz);
    expect(mes.disabled).toBe(false);
    expect(mes.value).toBe(formatarCompetencia(mesAtual()));

    await agir(() => enviarFormulario(raiz.querySelector("form")!));
    const corpo = chamadas[0].init.body as FormData;
    expect(corpo.get("tipo")).toBe("COMPLETA");
    expect(corpo.get("vigencia_inicio")).toBe(`${mesAtual()}-01`);
  });

  it("tem ajuda em Completa, Parcial, Correção e Mudança", async () => {
    const { raiz } = await prepararEnvio();
    const rotulos = [...raiz.querySelectorAll(".ajuda__botao")].map((b) => b.getAttribute("aria-label"));
    expect(rotulos).toEqual([
      "Ajuda: Parcial",
      "Ajuda: Completa",
      "Ajuda: Correção de cadastro",
      "Ajuda: Mudança a partir de",
    ]);
  });
});

describe("vigência no detalhe do lote", () => {
  const correcao = { vigencia_inicio: "2000-01-01", resumo: { correcao: true } } as Pick<Lote, "vigencia_inicio" | "resumo">;
  const mudanca = { vigencia_inicio: "2026-09-01", resumo: { correcao: false } } as Pick<Lote, "vigencia_inicio" | "resumo">;

  it("alterações e remoções mostram 'correção' ou 'a partir de MM/AAAA'", () => {
    expect(vigenciaDaDiferenca("TRIBUTAÇÃO ALTERADA", correcao)).toBe("correção");
    expect(vigenciaDaDiferenca("REMOVIDO", mudanca)).toBe("a partir de 09/2026");
  });

  it("itens incluídos valem para todos os meses", () => {
    expect(vigenciaDaDiferenca("INCLUÍDO", mudanca)).toBe("todos os meses");
    expect(vigenciaDaDiferenca("INCLUÍDO", correcao)).toBe("todos os meses");
  });

  it("lote antigo sem resumo.correcao: 2000-01-01 é correção", () => {
    expect(vigenciaDoLote({ vigencia_inicio: "2000-01-01", resumo: {} })).toBe("correção");
    expect(vigenciaDoLote({ vigencia_inicio: "2026-03-01", resumo: {} })).toBe("a partir de 03/2026");
  });
});
