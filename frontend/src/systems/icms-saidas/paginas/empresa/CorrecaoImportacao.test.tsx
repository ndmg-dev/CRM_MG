// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { agir, desmontarTudo, montar, respostaJson } from "../../testes/dom";
import type { Lote, ProblemasLote } from "../../tipos";
import { CorrecaoImportacao } from "./CorrecaoImportacao";
import { PROBLEMAS } from "./correcao.fixtures";

afterEach(() => {
  desmontarTudo();
  vi.unstubAllGlobals();
});

const URL_LOTE = "/api/empresas/0001/memoria/lotes/11111111-1111-1111-1111-111111111111";
const LOTE = {
  id: "11111111-1111-1111-1111-111111111111",
  tipo: "COMPLETA",
  status: "BLOQUEADO",
  vigencia_inicio: "2000-01-01",
  arquivo_nome: "memoria.xlsx",
  enviado_por: "web:ana",
  decidido_por: null,
  decidido_em: null,
  motivo: null,
  resumo: { corrigivel: true, correcao: true, problemas: { linhas_invalidas: 2, categorias: 2, categorias_linhas: 2, conflitos: 1, total: 5 } },
  bloqueios: [],
  avisos: [],
  criado_em: "2026-11-03T12:00:00Z",
} as Lote;

type Chamada = { url: string; metodo: string; corpo: unknown };

/** `resposta` pode devolver uma Response para sobrepor o padrão (GET problemas = fixture; escrita = lote reavaliado). */
function simular(problemas: ProblemasLote = PROBLEMAS, resposta?: (c: Chamada) => Response | undefined) {
  const chamadas: Chamada[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const c: Chamada = { url, metodo: init?.method ?? "GET", corpo: init?.body ? JSON.parse(String(init.body)) : undefined };
      chamadas.push(c);
      const personalizada = resposta?.(c);
      if (personalizada) return personalizada;
      if (c.metodo === "GET" && url.endsWith("/problemas")) return respostaJson(problemas);
      return respostaJson({ ...LOTE, status: "PENDENTE_APROVACAO", resumo: { problemas: { total: 0 } } });
    }),
  );
  return chamadas;
}

async function abrir(aoAtualizar: (mensagem: string) => void = () => {}) {
  const raiz = await montar(<CorrecaoImportacao url={URL_LOTE} lote={LOTE} aoAtualizar={aoAtualizar} />);
  await agir(() => {});
  return raiz;
}

function escolher(raiz: HTMLElement, rotulo: string, valor: string) {
  const select = raiz.querySelector<HTMLSelectElement>(`select[aria-label="${rotulo}"]`);
  expect(select, rotulo).toBeTruthy();
  select!.value = valor;
  select!.dispatchEvent(new Event("change", { bubbles: true }));
}

function digitar(raiz: HTMLElement, rotulo: string, texto: string) {
  const campo = raiz.querySelector<HTMLInputElement>(`input[aria-label="${rotulo}"]`);
  expect(campo, rotulo).toBeTruthy();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, texto); // setter nativo: o React só vê assim
  campo!.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Caixa "Ignorar linha N". */
function ignorarLinha(raiz: HTMLElement, linha: number) {
  const rotulo = [...raiz.querySelectorAll("label.correcao__ignorar")].find((l) => l.textContent?.trim() === `Ignorar linha ${linha}`);
  expect(rotulo, `Ignorar linha ${linha}`).toBeTruthy();
  rotulo!.querySelector<HTMLInputElement>("input")!.click();
}

const botao = (raiz: HTMLElement, texto: string | RegExp) =>
  [...raiz.querySelectorAll("button")].find((b) => (typeof texto === "string" ? b.textContent?.trim() === texto : texto.test(b.textContent ?? "")))!;

describe("Correção da importação", () => {
  it("lista os três tipos de problema, com ajuda, e o resumo do que está pendente", async () => {
    simular();
    const raiz = await abrir();
    expect(raiz.querySelector("h3")?.textContent).toContain("Corrigir a importação");
    expect(raiz.textContent).toContain("5 problemas pendentes: 2 linhas inválidas, 2 categorias desconhecidas (2 linhas), 1 conflito.");
    expect(raiz.textContent).toContain("ST - MONO");
    expect(raiz.textContent).toContain("PRODUTO 7");
    const ajudas = [...raiz.querySelectorAll(".ajuda__botao")].map((b) => b.getAttribute("aria-label"));
    expect(ajudas).toEqual(
      expect.arrayContaining(["Ajuda: Corrigir a importação", "Ajuda: Tributação desconhecida", "Ajuda: Linhas com dados inválidos", "Ajuda: Conflitos de tributação", "Ajuda: Categoria nova"]),
    );
    const opcoes = [...raiz.querySelectorAll<HTMLOptionElement>('select[aria-label="O que fazer com o texto ST - MONO"] option')].map((o) => o.textContent);
    expect(opcoes).toEqual(["Escolha…", "= NORMAL", "= ST", "Ignorar essas linhas"]); // só categorias que existem nas regras
    expect(raiz.querySelector('input[aria-label="Informar descrição da linha 6"]')).toBeTruthy(); // o campo certo de cada linha
    expect(raiz.querySelector('input[aria-label="Informar NCM da linha 7"]')).toBeTruthy();
  });

  it("Aplicar fica indisponível sem escolha; depois grava o conjunto completo, sem 'por'/'em' e sem nulos", async () => {
    const chamadas = simular();
    const mensagens: string[] = [];
    const raiz = await abrir((m) => mensagens.push(m));
    expect(botao(raiz, "Aplicar correções").disabled).toBe(true);
    expect(raiz.querySelector(".correcao__contagem")?.textContent).toBe("0 escolhas feitas");

    await agir(() => escolher(raiz, "O que fazer com o texto ST - MONO", "cat:ST"));
    await agir(() => escolher(raiz, "O que fazer com o texto RBC 70,59%", "ignorar"));
    await agir(() => digitar(raiz, "Informar descrição da linha 6", "PRODUTO 5"));
    await agir(() => ignorarLinha(raiz, 7));
    await agir(() => escolher(raiz, "Qual tributação vale para PRODUTO 7", "ST"));
    expect(raiz.querySelector(".correcao__contagem")?.textContent).toBe("5 escolhas feitas");
    expect(botao(raiz, "Aplicar correções").disabled).toBe(false);

    await agir(() => botao(raiz, "Aplicar correções").click());
    const put = chamadas.find((c) => c.metodo === "PUT")!;
    expect(put.url).toBe(`/api/v1/icms-saidas${URL_LOTE.slice(4)}/correcoes`);
    expect(put.corpo).toEqual({
      correcoes: [
        { tipo: "MAPEAR_CATEGORIA", texto: "ST - MONO", categoria: "ST" },
        { tipo: "IGNORAR_CATEGORIA", texto: "RBC 70,59%" },
        { tipo: "CORRIGIR_LINHA", linha: 6, descricao: "PRODUTO 5" },
        { tipo: "IGNORAR_LINHA", linha: 7 },
        { tipo: "ESCOLHER_CONFLITO", descricao: "PRODUTO 7", ncm: "39173900", categoria: "ST" },
      ],
    });
    expect(mensagens).toEqual(["Correções gravadas. Sem problemas pendentes: confira as diferenças e aplique o lote."]);
  });

  it("se ainda sobra problema, a mensagem diz quantos faltam", async () => {
    simular(PROBLEMAS, (c) =>
      c.metodo === "PUT" ? respostaJson({ ...LOTE, resumo: { problemas: { total: 3 } } }) : undefined,
    );
    const mensagens: string[] = [];
    const raiz = await abrir((m) => mensagens.push(m));
    await agir(() => escolher(raiz, "O que fazer com o texto ST - MONO", "cat:ST"));
    await agir(() => botao(raiz, "Aplicar correções").click());
    expect(mensagens).toEqual(["Correções gravadas. Ainda há 3 problemas a resolver."]);
  });

  it("'Ignorar todas' marca todas as linhas inválidas e desfaz com o mesmo botão", async () => {
    simular();
    const raiz = await abrir();
    await agir(() => botao(raiz, /^Ignorar todas/).click());
    expect([...raiz.querySelectorAll<HTMLInputElement>(".correcao__ignorar input")].map((i) => i.checked)).toEqual([true, true]);
    expect(raiz.querySelector(".correcao__contagem")?.textContent).toBe("2 escolhas feitas");
    await agir(() => botao(raiz, /^Desfazer ignorar todas/).click());
    expect([...raiz.querySelectorAll<HTMLInputElement>(".correcao__ignorar input")].map((i) => i.checked)).toEqual([false, false]);
  });

  it("decisões já gravadas aparecem preenchidas e Aplicar só vale depois de uma mudança", async () => {
    simular({
      ...PROBLEMAS,
      categorias: [{ ...PROBLEMAS.categorias[0], resolvido: true, decisao: { tipo: "MAPEAR_CATEGORIA", texto: "ST - MONO", categoria: "ST", por: "web:ana", em: "x" } }],
      linhas_invalidas: [],
      conflitos: [],
    });
    const raiz = await abrir();
    expect(raiz.querySelector<HTMLSelectElement>('select[aria-label="O que fazer com o texto ST - MONO"]')!.value).toBe("cat:ST");
    expect(botao(raiz, "Aplicar correções").disabled).toBe(true); // nada mudou desde o que está gravado
    await agir(() => escolher(raiz, "O que fazer com o texto ST - MONO", "cat:NORMAL"));
    expect(botao(raiz, "Aplicar correções").disabled).toBe(false);
  });

  it("erro do motor (categoria inexistente) aparece com o código e nada é dado como gravado", async () => {
    simular(PROBLEMAS, (c) =>
      c.metodo === "PUT"
        ? respostaJson({ erro: { codigo: "CATEGORIA_INEXISTENTE", mensagem: "A categoria 'X' não existe nas regras fiscais vigentes para este lote.", detalhes: ["ST"] } }, 422)
        : undefined,
    );
    const mensagens: string[] = [];
    const raiz = await abrir((m) => mensagens.push(m));
    await agir(() => escolher(raiz, "O que fazer com o texto ST - MONO", "cat:ST"));
    await agir(() => botao(raiz, "Aplicar correções").click());
    expect(raiz.textContent).toContain("Não foi possível gravar as correções");
    expect(raiz.textContent).toContain("CATEGORIA_INEXISTENTE");
    expect(raiz.textContent).toContain("A memória da empresa não foi alterada.");
    expect(mensagens).toEqual([]);
  });

  it("acima de 500 decisões não envia: orienta usar a planilha dos problemas", async () => {
    const muitas = Array.from({ length: 501 }, (_, i) => ({
      ...PROBLEMAS.linhas_invalidas[0],
      linha: i + 2,
    }));
    const chamadas = simular({ ...PROBLEMAS, categorias: [], conflitos: [], linhas_invalidas: muitas, total_linhas_invalidas: 501 });
    const raiz = await abrir();
    await agir(() => botao(raiz, /^Ignorar todas/).click());
    await agir(() => botao(raiz, "Aplicar correções").click());
    expect(chamadas.some((c) => c.metodo === "PUT")).toBe(false);
    expect(raiz.textContent).toContain("São 501 decisões e o limite por envio é 500");
    expect(raiz.textContent).toContain("planilha dos problemas");
  });

  it("lista cortada pelo motor avisa quantas linhas há no total", async () => {
    simular({ ...PROBLEMAS, total_linhas_invalidas: 1234 });
    const raiz = await abrir();
    expect(raiz.textContent).toContain("Mostrando 2 de 1.234 linhas inválidas");
  });

  it("Reavaliar lote chama o motor e avisa o pai", async () => {
    const chamadas = simular();
    const mensagens: string[] = [];
    const raiz = await abrir((m) => mensagens.push(m));
    await agir(() => botao(raiz, "Reavaliar lote").click());
    expect(chamadas.find((c) => c.metodo === "POST")?.url).toBe(`/api/v1/icms-saidas${URL_LOTE.slice(4)}/reavaliar`);
    expect(mensagens).toEqual(["Lote reavaliado com as regras fiscais atuais."]);
  });

  it("falha ao ler o arquivo do lote: erro com 'Tentar de novo', sem campos de correção", async () => {
    simular(PROBLEMAS, (c) => (c.url.endsWith("/problemas") ? respostaJson({ erro: { codigo: "ARQUIVO_NAO_ENCONTRADO", mensagem: "O arquivo não está mais disponível." } }, 404) : undefined));
    const raiz = await abrir();
    expect(raiz.textContent).toContain("Não foi possível carregar os problemas do lote");
    expect(raiz.textContent).toContain("ARQUIVO_NAO_ENCONTRADO");
    expect(raiz.querySelector("select")).toBeNull();
    expect(botao(raiz, "Tentar de novo")).toBeTruthy();
  });
});

describe("Correção da importação – paginação", () => {
  const linhas = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ ...PROBLEMAS.linhas_invalidas[0], linha: i + 2, descricao: `ITEM ${i + 2}` }));

  it("120 linhas inválidas: 50 por página, a escolha numa página continua valendo na outra e 'Ignorar todas' alcança as 120", async () => {
    const chamadas = simular({ ...PROBLEMAS, categorias: [], conflitos: [], linhas_invalidas: linhas(120), total_linhas_invalidas: 120 });
    const raiz = await abrir();
    expect(raiz.querySelectorAll('tbody input[type="checkbox"]')).toHaveLength(50);
    expect(raiz.querySelector("nav.paginacao")!.textContent).toContain("1–50 de 120");

    await agir(() => digitar(raiz, "Informar descrição da linha 2", "PRODUTO CORRIGIDO"));
    await agir(() => botao(raiz.querySelector("nav.paginacao") as HTMLElement, "Próxima").click());
    expect(raiz.querySelector("nav.paginacao")!.textContent).toContain("51–100 de 120");
    expect(raiz.querySelector('input[aria-label="Informar descrição da linha 2"]')).toBeNull(); // saiu da página
    await agir(() => botao(raiz.querySelector("nav.paginacao") as HTMLElement, "Anterior").click());
    expect(raiz.querySelector<HTMLInputElement>('input[aria-label="Informar descrição da linha 2"]')!.value).toBe("PRODUTO CORRIGIDO"); // não se perdeu

    await agir(() => botao(raiz, /^Ignorar todas \(120\)/).click());
    expect(raiz.querySelector(".correcao__contagem")?.textContent).toBe("120 escolhas feitas"); // todas, não só a página
    await agir(() => botao(raiz, "Aplicar correções").click());
    const put = chamadas.find((c) => c.metodo === "PUT")!;
    expect((put.corpo as { correcoes: unknown[] }).correcoes).toHaveLength(120);
  });

  it("até 50 itens não mostra paginação", async () => {
    simular({ ...PROBLEMAS, categorias: [], conflitos: [], linhas_invalidas: linhas(50), total_linhas_invalidas: 50 });
    const raiz = await abrir();
    expect(raiz.querySelector("nav.paginacao")).toBeNull();
  });
});
