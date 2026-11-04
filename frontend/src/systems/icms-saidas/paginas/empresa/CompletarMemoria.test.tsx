// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { agir, desmontarTudo, escolherArquivo, montar, respostaJson } from "../../testes/dom";
import type { Divergencia, Lote, ResultadoCompletar } from "../../tipos";
import { CompletarMemoria } from "./CompletarMemoria";

afterEach(() => {
  desmontarTudo();
  vi.unstubAllGlobals();
});

const BASE = "/api/empresas/0001/memoria";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const arq = (nome: string, tamanho = 100) => new File([new Uint8Array(tamanho)], nome, { type: XLSX });

const LOTE = {
  id: "22222222-2222-2222-2222-222222222222", tipo: "PARCIAL", status: "PENDENTE_APROVACAO", vigencia_inicio: "2000-01-01", arquivo_nome: "memoria-completada.csv",
  enviado_por: "web:ana", decidido_por: null, decidido_em: null, motivo: null, resumo: { incluidos: 2, correcao: true }, bloqueios: [], avisos: [], criado_em: "2026-11-03T12:00:00Z",
} as Lote;

const divergencia = (i: number): Divergencia => ({ codigo: String(i), ncm: "40159000", descricao: `LUVA ${i}`, icms_pela_descricao: "NORMAL", icms_pelo_codigo: "ST" });
const RESULTADO = (extra: Partial<ResultadoCompletar> = {}): ResultadoCompletar => ({
  lote: LOTE,
  relatorio: { adicionadas: 2, ja_batem_pela_descricao: 5, sem_correspondencia: 1, origem_ambigua: 0, divergencias_codigo_vs_descricao: 0 },
  divergencias: [],
  total_divergencias: 0,
  ...extra,
});

type Envio = { url: string; form: FormData };

function simular(resposta: Response | (() => Response) = respostaJson(RESULTADO(), 201)) {
  const envios: Envio[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.body instanceof FormData) envios.push({ url, form: init.body });
      return typeof resposta === "function" ? resposta() : resposta.clone();
    }),
  );
  return envios;
}

async function abrir(aoAbrirLote: (id: string) => void = () => {}) {
  const raiz = await montar(<CompletarMemoria base={BASE} aoAbrirLote={aoAbrirLote} />);
  await agir(() => botao(raiz, "Completar memória…").click());
  return raiz;
}

const botao = (raiz: ParentNode, texto: string | RegExp) =>
  [...raiz.querySelectorAll<HTMLButtonElement>("button")].find((b) => (typeof texto === "string" ? b.textContent?.trim() === texto : texto.test(b.textContent ?? "")))!;

function escolherSaidas(raiz: HTMLElement, arquivos: File[]) {
  const campo = raiz.querySelector<HTMLInputElement>('input[type="file"][multiple]')!;
  Object.defineProperty(campo, "files", { configurable: true, value: arquivos });
  campo.dispatchEvent(new Event("change", { bubbles: true }));
}

const escolherMemoria = (raiz: HTMLElement, f: File) => escolherArquivo(raiz.querySelector<HTMLInputElement>('input[type="file"]:not([multiple])')!, f);

describe("Completar a memória", () => {
  it("começa recolhido, com ajuda, e abre o formulário; sem arquivos o envio fica indisponível dizendo por quê", async () => {
    const raiz = await montar(<CompletarMemoria base={BASE} aoAbrirLote={() => {}} />);
    expect(raiz.querySelector("form")).toBeNull();
    expect(raiz.querySelector('.ajuda__botao[aria-label="Ajuda: Completar a memória"]')).toBeTruthy();
    await agir(() => botao(raiz, "Completar memória…").click());
    expect(raiz.querySelector("form")).not.toBeNull();
    const enviar = botao(raiz, "Gerar lote para revisar");
    expect(enviar.getAttribute("aria-disabled")).toBe("true");
    expect(raiz.textContent).toContain("Escolha a memória com a coluna do código.");
    await agir(() => escolherMemoria(raiz, arq("memoria.xlsx")));
    expect(raiz.textContent).toContain("Escolha ao menos um relatório de saídas.");
    await agir(() => escolherSaidas(raiz, [arq("saidas.xlsx")]));
    expect(botao(raiz, "Gerar lote para revisar").getAttribute("aria-disabled")).toBeNull();
  });

  it("recusa relatório que não é .xlsx e mais de 6 relatórios, sem enviar nada", async () => {
    const envios = simular();
    const raiz = await abrir();
    await agir(() => escolherSaidas(raiz, [arq("saidas.csv")]));
    expect(raiz.textContent).toContain("Os relatórios de saídas devem ser arquivos .xlsx.");
    await agir(() => escolherSaidas(raiz, Array.from({ length: 7 }, (_, i) => arq(`s${i}.xlsx`))));
    expect(raiz.textContent).toContain("Escolha no máximo 6 relatórios.");
    expect(raiz.querySelector(".completar__arquivos")).toBeNull();
    expect(envios).toEqual([]);
  });

  it("envia a memória, TODOS os relatórios e o modo (padrão: só acrescentar)", async () => {
    const envios = simular();
    const raiz = await abrir();
    await agir(() => escolherMemoria(raiz, arq("memoria.xlsx")));
    await agir(() => escolherSaidas(raiz, [arq("saidas07.xlsx"), arq("saidas08.xlsx")]));
    expect(raiz.querySelector(".completar__arquivos")!.textContent).toContain("saidas07.xlsx");
    await agir(() => botao(raiz, "Gerar lote para revisar").click());
    expect(envios).toHaveLength(1);
    const { url, form } = envios[0];
    expect(url).toBe(`/api/v1/icms-saidas${BASE.slice(4)}/completar`);
    expect((form.get("memoria") as File).name).toBe("memoria.xlsx");
    expect(form.getAll("saidas").map((f) => (f as File).name)).toEqual(["saidas07.xlsx", "saidas08.xlsx"]);
    expect(form.get("modo")).toBe("ACRESCIMOS");
  });

  it("memória completa: envia modo COMPLETA", async () => {
    const envios = simular();
    const raiz = await abrir();
    await agir(() => escolherMemoria(raiz, arq("memoria.xlsx")));
    await agir(() => escolherSaidas(raiz, [arq("s.xlsx")]));
    await agir(() => raiz.querySelector<HTMLInputElement>('input[type="radio"][value="COMPLETA"]')!.click());
    await agir(() => botao(raiz, "Gerar lote para revisar").click());
    expect(envios[0].form.get("modo")).toBe("COMPLETA");
  });

  it("mostra o resultado e leva ao lote para revisar (nada foi gravado ainda)", async () => {
    simular();
    const abertos: string[] = [];
    const raiz = await abrir((id) => abertos.push(id));
    await agir(() => escolherMemoria(raiz, arq("memoria.xlsx")));
    await agir(() => escolherSaidas(raiz, [arq("s.xlsx")]));
    await agir(() => botao(raiz, "Gerar lote para revisar").click());
    const resultado = raiz.querySelector(".completar__resultado")!;
    expect(resultado.textContent).toContain("2 linhas acrescentadas");
    expect(resultado.textContent).toContain("5 produtos já batiam pela descrição");
    expect(resultado.textContent).toContain("1 produto sem correspondência: continuam como pendência na apuração");
    expect(resultado.textContent).toContain("Lote gerado: falta você revisar e aprovar");
    expect(resultado.textContent).toContain("Nada foi gravado na memória ainda.");
    await agir(() => botao(resultado, "Abrir o lote para revisar").click());
    expect(abertos).toEqual([LOTE.id]);
  });

  it("lote bloqueado (com problemas) avisa que a correção resolve; sem lote diz que não há o que acrescentar", async () => {
    simular(respostaJson(RESULTADO({ lote: { ...LOTE, status: "BLOQUEADO" } }), 201));
    const raiz = await abrir();
    await agir(() => escolherMemoria(raiz, arq("m.xlsx")));
    await agir(() => escolherSaidas(raiz, [arq("s.xlsx")]));
    await agir(() => botao(raiz, "Gerar lote para revisar").click());
    expect(raiz.querySelector(".completar__resultado")!.textContent).toContain("Lote gerado com problemas a resolver");
    expect(raiz.querySelector(".completar__resultado")!.textContent).toContain("a tela de correção resolve");
    desmontarTudo();

    simular(respostaJson(RESULTADO({ lote: null, relatorio: { adicionadas: 0, ja_batem_pela_descricao: 9, sem_correspondencia: 0 } }), 200));
    const vazio = await abrir();
    await agir(() => escolherMemoria(vazio, arq("m.xlsx")));
    await agir(() => escolherSaidas(vazio, [arq("s.xlsx")]));
    await agir(() => botao(vazio, "Gerar lote para revisar").click());
    expect(vazio.textContent).toContain("Nada a acrescentar");
    expect(vazio.textContent).not.toContain("Abrir o lote para revisar");
  });

  it("divergências entre código e descrição em tabela paginada, e avisa quando o motor cortou a lista", async () => {
    const todas = Array.from({ length: 25 }, (_, i) => divergencia(i + 1));
    simular(respostaJson(RESULTADO({ divergencias: todas, total_divergencias: 340 }), 201));
    const raiz = await abrir();
    await agir(() => escolherMemoria(raiz, arq("m.xlsx")));
    await agir(() => escolherSaidas(raiz, [arq("s.xlsx")]));
    await agir(() => botao(raiz, "Gerar lote para revisar").click());
    const secao = raiz.querySelector(".completar__divergencias")!;
    expect(secao.textContent).toContain("340 divergências entre código e descrição");
    expect(secao.textContent).toContain("Mostrando 25 de 340");
    expect(secao.querySelectorAll("tbody tr")).toHaveLength(20);
    expect(secao.textContent).toContain("Vale hoje (pela descrição)");
    expect(secao.querySelector("tbody")!.textContent).toContain("NORMAL");
    await agir(() => botao(secao, "Próxima").click());
    expect(secao.querySelectorAll("tbody tr")).toHaveLength(5);
  });

  it("erro do motor aparece com o código e diz que nada foi gravado", async () => {
    simular(respostaJson({ erro: { codigo: "ARQUIVO_INVALIDO", mensagem: "saidas07.xlsx: O layout das colunas A–T não confere.", detalhes: ["coluna 2: esperado NOTA"] } }, 422));
    const raiz = await abrir();
    await agir(() => escolherMemoria(raiz, arq("m.xlsx")));
    await agir(() => escolherSaidas(raiz, [arq("saidas07.xlsx")]));
    await agir(() => botao(raiz, "Gerar lote para revisar").click());
    expect(raiz.textContent).toContain("A memória não foi completada");
    expect(raiz.textContent).toContain("ARQUIVO_INVALIDO");
    expect(raiz.textContent).toContain("saidas07.xlsx: O layout das colunas A–T não confere.");
    expect(raiz.textContent).toContain("Nada foi gravado na memória.");
    expect(raiz.querySelector(".completar__resultado")).toBeNull();
  });
});
