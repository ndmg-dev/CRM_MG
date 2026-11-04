// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { agir, desmontarTudo, enviarFormulario, montar, respostaJson } from "../../testes/dom";
import { AbaPendencias } from "./AbaPendencias";

const PENDENCIA = {
  id: 7,
  descricao: "PARAFUSO",
  ncm: "73181500",
  cfop_exemplo: 5102,
  ocorrencias: 3,
  valor_total: 120.5,
  status: "ABERTA",
  tributacao_definida: null,
  resolvido_por: null,
  resolvido_em: null,
  criado_em: "2026-10-01T12:00:00Z",
};

const chamadas: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
  chamadas.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      if (url.includes("/pendencias?")) return respostaJson([PENDENCIA]);
      if (url.startsWith("/api/v1/icms-saidas/regras"))
        return respostaJson({
          versao: 3,
          versao_atual: 3,
          competencia: null,
          conteudo: { categorias: [{ nome: "ST", grupo: "ST" }, { nome: "RBC 42,93% / 73,33%", grupo: "ANEXO I" }], aliases: [] },
        });
      return respostaJson({ ok: true });
    }),
  );
});

afterEach(() => {
  desmontarTudo();
  vi.unstubAllGlobals();
});

describe("Resolver pendência", () => {
  it("não tem campo de mês e envia só a tributação (item novo vale para todos os meses)", async () => {
    const raiz = await montar(<AbaPendencias codigo="0001" />);
    await agir(() => {});
    const resolver = [...raiz.querySelectorAll("button")].find((b) => b.textContent === "Resolver")!;
    await agir(() => resolver.click());

    const formulario = raiz.querySelector<HTMLFormElement>("tr.pendencias__formulario form")!;
    expect(formulario.querySelector('input[type="month"]')).toBeNull();
    expect(formulario.textContent).toContain("Item novo: vale para todos os meses.");
    expect(formulario.querySelector(".ajuda__botao")?.getAttribute("aria-label")).toBe("Ajuda: Itens novos");

    const select = formulario.querySelector("select")!;
    // categorias das regras globais (não há mais config por empresa), com o grupo quando difere do nome
    expect(chamadas.some((c) => c.url === "/api/v1/icms-saidas/regras")).toBe(true);
    expect([...select.options].map((o) => o.textContent)).toEqual(["Escolha…", "RBC 42,93% / 73,33% (ANEXO I)", "ST"]);
    await agir(() => {
      select.value = "ST";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await agir(() => enviarFormulario(formulario));

    const post = chamadas.find((c) => c.init.method === "POST")!;
    expect(post.url).toBe("/api/v1/icms-saidas/empresas/0001/pendencias/7/resolver");
    expect(JSON.parse(post.init.body as string)).toEqual({ tributacao: "ST" });
    expect(raiz.textContent).toContain("PARAFUSO (NCM 73181500) cadastrado na memória como ST.");
  });
});

// ------------------------------------------------------------------------------------- sugestões e lote (ADR-010 do motor)
import type { Pendencia, ResumoSugestoes, SugestaoPendencia } from "../../tipos";

const sugestao = (nivel: "IDENTICO" | "PARECIDO", icms = "ST", descricao = "PARAFUSO 1/4 X 2"): SugestaoPendencia => ({
  item_id: 1, descricao, icms, nivel, similaridade: nivel === "IDENTICO" ? 1 : 0.8,
});
const P = (id: number, extra: Partial<Pendencia> = {}): Pendencia => ({ ...PENDENCIA, id, descricao: `PRODUTO ${id}`, ...extra });
const REGRAS = {
  versao: 3, versao_atual: 3, competencia: null,
  conteudo: { categorias: [{ nome: "NORMAL", grupo: "NORMAL" }, { nome: "ST", grupo: "ST" }], aliases: [] },
};

type Post = { url: string; corpo: Record<string, unknown> };

type Config = { falharNoPost?: number; total?: number; resumo?: Partial<ResumoSugestoes>; respostaPost?: (corpo: Record<string, unknown>, url: string) => Record<string, unknown> };

const comTotal = (corpo: unknown, total: number) =>
  new Response(JSON.stringify(corpo), { status: 200, headers: { "Content-Type": "application/json", "X-Total-Count": String(total) } });

/** Panorama coerente com a lista (o motor conta TODAS as abertas; aqui, as da lista simulada). */
function resumoDe(lista: Pendencia[], extra: Partial<ResumoSugestoes> = {}): ResumoSugestoes {
  const ident = lista.filter((p) => p.sugestao_aceitavel).length;
  const parec = lista.filter((p) => !p.sugestao_aceitavel && (p.sugestoes?.length ?? 0) > 0).length;
  return { abertas: lista.length, identicas_aceitaveis: ident, identicas_ambiguas: 0, parecidas: parec, sem_sugestao: lista.length - ident - parec, ...extra };
}

function simularLote(lista: Pendencia[], config: Config | number = {}) {
  const cfg: Config = typeof config === "number" ? { falharNoPost: config } : config;
  const gets: string[] = [];
  const posts: Post[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const corpo = JSON.parse(String(init.body ?? "{}"));
        posts.push({ url, corpo });
        if (cfg.falharNoPost !== undefined && posts.length === cfg.falharNoPost)
          return respostaJson({ erro: { codigo: "LOTE_BLOQUEADO", mensagem: "O lote das pendências foi bloqueado pelas travas da memória." } }, 409);
        if (cfg.respostaPost) return respostaJson(cfg.respostaPost(corpo, url));
        const n = (corpo.resolucoes as unknown[] | undefined)?.length ?? 1;
        return respostaJson({ resolvidas: n, adicionadas: n, sobrescritas: 0, mantidas: 0, ja_tratadas: 0, lote_id: "x" });
      }
      if (url.startsWith("/api/v1/icms-saidas/regras")) return respostaJson(REGRAS);
      if (url.includes("/pendencias/resumo-sugestoes")) return respostaJson(resumoDe(lista, cfg.resumo));
      if (url.includes("/pendencias/exportar")) return new Response(new Blob(["xlsx"]), { status: 200, headers: { "Content-Type": "application/octet-stream" } });
      if (url.includes("/pendencias?")) {
        gets.push(url);
        return comTotal(lista, cfg.total ?? lista.length);
      }
      return respostaJson({});
    }),
  );
  return { gets, posts };
}

async function abrirLote() {
  const raiz = await montar(<AbaPendencias codigo="0001" />);
  await agir(() => {});
  return raiz;
}

const botao = (raiz: HTMLElement, texto: string | RegExp) =>
  [...raiz.querySelectorAll<HTMLButtonElement>("button")].find((b) => (typeof texto === "string" ? b.textContent?.trim() === texto : texto.test(b.textContent ?? "")))!;
const caixa = (raiz: HTMLElement, rotulo: string) => raiz.querySelector<HTMLInputElement>(`input[aria-label="${rotulo}"]`)!;
const marcadas = (raiz: HTMLElement) => [...raiz.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')].map((c) => c.checked);

const MISTA = [
  P(1, { sugestoes: [sugestao("IDENTICO", "ST")], sugestao_aceitavel: sugestao("IDENTICO", "ST") }),
  P(2, { sugestoes: [sugestao("PARECIDO", "NORMAL", "PARAFUSO 1/4 X 2 ZINCADO")], sugestao_aceitavel: null }),
  P(3, { sugestoes: [], sugestao_aceitavel: null }),
  P(4, { sugestoes: [sugestao("IDENTICO", "NORMAL", "TUBO PVC")], sugestao_aceitavel: sugestao("IDENTICO", "NORMAL", "TUBO PVC") }),
];

describe("Pendências – sugestão da memória", () => {
  it("pede as sugestões ao motor nas abertas e mostra idêntico, parecido e sem sugestão", async () => {
    const { gets } = simularLote(MISTA);
    const raiz = await abrirLote();
    expect(gets[0]).toContain("sugestoes=true");
    const linhas = [...raiz.querySelectorAll("tbody tr")].map((l) => l.textContent ?? "");
    expect(linhas[0]).toContain("Idêntico");
    expect(linhas[0]).toContain("PARAFUSO 1/4 X 2");
    expect(linhas[1]).toContain("Parecido 80%");
    expect(linhas[2]).toContain("sem sugestão");
    expect(raiz.querySelector('.ajuda__botao[aria-label="Ajuda: Sugestão da memória"]')).toBeTruthy();
  });

  it("em 'Todas' não há sugestão, seleção nem barra de lote (e o motor não é chamado com sugestoes)", async () => {
    const { gets } = simularLote(MISTA);
    const raiz = await abrirLote();
    const todas = [...raiz.querySelectorAll<HTMLButtonElement>("button, [role=radio]")].find((b) => b.textContent === "Todas")!;
    await agir(() => todas.click());
    expect(gets[gets.length - 1]).not.toContain("sugestoes");
    expect(raiz.querySelector('input[type="checkbox"]')).toBeNull();
    expect(raiz.querySelector(".pendencias__lote")).toBeNull();
  });

  it("'Aceitar sugestão' na linha cadastra com a tributação do item sugerido", async () => {
    const { posts } = simularLote(MISTA);
    const raiz = await abrirLote();
    await agir(() => botao(raiz, "Aceitar sugestão")!.click());
    expect(posts).toEqual([{ url: "/api/v1/icms-saidas/empresas/0001/pendencias/1/resolver", corpo: { tributacao: "ST" } }]);
    expect(raiz.textContent).toContain("PRODUTO 1 (NCM 73181500) cadastrado na memória como ST, a mesma tributação de PARAFUSO 1/4 X 2.");
  });
});

describe("Pendências – resolver em lote", () => {
  it("'Selecionar idênticas' marca só as que têm sugestão idêntica", async () => {
    simularLote(MISTA);
    const raiz = await abrirLote();
    expect(raiz.querySelector(".pendencias__lote-resumo")?.textContent).toBe("0 selecionadas");
    await agir(() => botao(raiz, /^Selecionar idênticas/).click());
    expect(marcadas(raiz)).toEqual([true, false, false, true]); // a parecida e a sem sugestão ficam de fora
    expect(raiz.querySelector(".pendencias__lote-resumo")?.textContent).toBe("2 selecionadas");
  });

  it("aceitar sugestão das selecionadas envia SÓ as aceitáveis, cada uma com a tributação do item sugerido", async () => {
    const { posts, gets } = simularLote(MISTA);
    const raiz = await abrirLote();
    expect(botao(raiz, /^Aceitar sugestão das selecionadas/).disabled).toBe(true); // nada selecionado
    await agir(() => caixa(raiz, "Selecionar todas desta página").click()); // inclui a parecida e a sem sugestão
    expect(botao(raiz, /^Aceitar sugestão das selecionadas \(2\)/)).toBeTruthy(); // só 2 das 4 são aceitáveis
    const antes = gets.length;
    await agir(() => botao(raiz, /^Aceitar sugestão das selecionadas/).click());
    expect(posts).toEqual([
      {
        url: "/api/v1/icms-saidas/empresas/0001/pendencias/resolver-lote",
        corpo: { resolucoes: [{ pendencia_id: 1, tributacao: "ST" }, { pendencia_id: 4, tributacao: "NORMAL" }], sobrescrever: false },
      },
    ]);
    expect(raiz.textContent).toContain("2 pendências resolvidas: 2 cadastradas na memória.");
    expect(gets.length).toBeGreaterThan(antes); // a lista é recarregada
  });

  it("gravar a tributação escolhida vale para todas as selecionadas, inclusive parecida e sem sugestão", async () => {
    const { posts } = simularLote(MISTA);
    const raiz = await abrirLote();
    expect(botao(raiz, "Gravar tributação nas selecionadas").disabled).toBe(true);
    await agir(() => caixa(raiz, "Selecionar PRODUTO 2").click());
    await agir(() => caixa(raiz, "Selecionar PRODUTO 3").click());
    const select = raiz.querySelector<HTMLSelectElement>('select[aria-label="Tributação para as selecionadas"]')!;
    await agir(() => {
      select.value = "ST";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await agir(() => botao(raiz, "Gravar tributação nas selecionadas").click());
    expect(posts[0].corpo).toEqual({ resolucoes: [{ pendencia_id: 2, tributacao: "ST" }, { pendencia_id: 3, tributacao: "ST" }], sobrescrever: false });
    expect(raiz.textContent).toContain("2 pendências resolvidas: 2 cadastradas na memória.");
  });

  it("450 selecionadas vão em dois blocos (400 + 50), cada um um lote do motor", async () => {
    const muitas = Array.from({ length: 450 }, (_, i) => P(i + 1, { sugestoes: [sugestao("IDENTICO")], sugestao_aceitavel: sugestao("IDENTICO") }));
    const { posts } = simularLote(muitas);
    const raiz = await abrirLote();
    await agir(() => botao(raiz, /^Selecionar idênticas/).click());
    await agir(() => botao(raiz, /^Aceitar sugestão das selecionadas/).click());
    expect(posts.map((p) => (p.corpo.resolucoes as unknown[]).length)).toEqual([400, 50]);
    expect(raiz.textContent).toContain("450 pendências resolvidas: 450 cadastradas na memória.");
  });

  it("se o segundo bloco falha, mostra o erro do motor e quantas já foram resolvidas", async () => {
    const muitas = Array.from({ length: 450 }, (_, i) => P(i + 1, { sugestoes: [sugestao("IDENTICO")], sugestao_aceitavel: sugestao("IDENTICO") }));
    const { posts } = simularLote(muitas, 2);
    const raiz = await abrirLote();
    await agir(() => botao(raiz, /^Selecionar idênticas/).click());
    await agir(() => botao(raiz, /^Aceitar sugestão das selecionadas/).click());
    expect(posts).toHaveLength(2);
    expect(raiz.textContent).toContain("LOTE_BLOQUEADO");
    expect(raiz.textContent).toContain("O lote das pendências foi bloqueado pelas travas da memória.");
    expect(raiz.textContent).toContain("400 pendências resolvidas: 400 cadastradas na memória — antes do erro.");
  });

  it("sem nenhuma aceitável selecionada, o aceite em lote fica indisponível e não envia", async () => {
    const { posts } = simularLote(MISTA);
    const raiz = await abrirLote();
    await agir(() => caixa(raiz, "Selecionar PRODUTO 2").click()); // só a parecida
    expect(botao(raiz, /^Aceitar sugestão das selecionadas \(0\)/).disabled).toBe(true);
    await agir(() => botao(raiz, /^Aceitar sugestão das selecionadas/).click());
    expect(posts).toEqual([]);
  });
});

// ------------------------------------------------------- resumo de todas as páginas, aceitar idênticas, planilha e paginação

beforeAll(() => {
  // jsdom não implementa showModal/close do <dialog>.
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

const botaoEm = (alvo: ParentNode, texto: string | RegExp) =>
  [...alvo.querySelectorAll<HTMLButtonElement>("button")].find((b) => (typeof texto === "string" ? b.textContent?.trim() === texto : texto.test(b.textContent ?? "")))!;

describe("Pendências – resumo e aceite das idênticas (todas as páginas)", () => {
  it("mostra o panorama de TODAS as abertas, não só da página, e o botão com a contagem das idênticas", async () => {
    simularLote(MISTA, { resumo: { abertas: 533, identicas_aceitaveis: 412, identicas_ambiguas: 20, parecidas: 80, sem_sugestao: 21 } });
    const raiz = await abrirLote();
    const resumo = raiz.querySelector(".pendencias__resumo")!;
    expect(resumo.textContent).toContain("533 abertas");
    expect(resumo.textContent).toContain("412 idênticas");
    expect(resumo.textContent).toContain("20 ambíguas");
    expect(resumo.textContent).toContain("80 parecidas");
    expect(resumo.textContent).toContain("21 sem sugestão");
    expect(botaoEm(resumo, "Aceitar as 412 idênticas")).toBeTruthy();
    expect(resumo.querySelector('.ajuda__botao[aria-label="Ajuda: Resumo das pendências"]')).toBeTruthy();
  });

  it("pede confirmação e só então envia, sem ids: quem escolhe o que aceitar é o motor", async () => {
    const { posts } = simularLote(MISTA, {
      resumo: { identicas_aceitaveis: 412 },
      respostaPost: () => ({ resolvidas: 412, adicionadas: 412, sobrescritas: 0, mantidas: 0, ja_tratadas: 0, lote_id: "x", encontradas: 412, restantes: 0 }),
    });
    const raiz = await abrirLote();
    await agir(() => botaoEm(raiz, /^Aceitar as 412 idênticas/).click());
    const dialogo = raiz.querySelector("dialog[open]")!;
    expect(dialogo.textContent).toContain("412 pendências");
    expect(dialogo.textContent).toContain("As parecidas, ambíguas e sem sugestão não serão tocadas.");
    expect(posts).toEqual([]); // abrir o diálogo não grava nada
    await agir(() => botaoEm(dialogo, "Cadastrar 412 na memória").click());
    expect(posts).toEqual([{ url: "/api/v1/icms-saidas/empresas/0001/pendencias/aceitar-identicas", corpo: { sobrescrever: false } }]);
    expect(raiz.textContent).toContain("412 pendências resolvidas: 412 cadastradas na memória.");
  });

  it("Cancelar não envia nada; com 'Sobrescrever' marcado envia true", async () => {
    const { posts } = simularLote(MISTA, { resumo: { identicas_aceitaveis: 5 } });
    const raiz = await abrirLote();
    await agir(() => botaoEm(raiz, /^Aceitar as 5 idênticas/).click());
    await agir(() => botaoEm(raiz.querySelector("dialog[open]")!, "Cancelar").click());
    expect(posts).toEqual([]);
    await agir(() => botaoEm(raiz, /^Aceitar as 5 idênticas/).click());
    await agir(() => raiz.querySelector<HTMLInputElement>("dialog[open] input[type=checkbox]")!.click());
    await agir(() => botaoEm(raiz.querySelector("dialog[open]")!, "Cadastrar 5 na memória").click());
    expect(posts[0].corpo).toEqual({ sobrescrever: true });
  });

  it("avisa quando sobraram idênticas para uma próxima rodada (limite por lote do motor)", async () => {
    simularLote(MISTA, {
      resumo: { identicas_aceitaveis: 6000 },
      respostaPost: () => ({ resolvidas: 5000, adicionadas: 5000, sobrescritas: 0, mantidas: 0, ja_tratadas: 0, lote_id: "x", encontradas: 6000, restantes: 1000 }),
    });
    const raiz = await abrirLote();
    await agir(() => botaoEm(raiz, /^Aceitar as/).click());
    await agir(() => botaoEm(raiz.querySelector("dialog[open]")!, /^Cadastrar/).click());
    expect(raiz.textContent).toContain("5.000 pendências resolvidas");
    expect(raiz.textContent).toContain("Ainda há 1.000 idênticas para aceitar: repita a ação.");
  });

  it("sem idênticas o botão fica indisponível; sem pendência aberta o resumo some", async () => {
    simularLote(MISTA, { resumo: { identicas_aceitaveis: 0 } });
    const raiz = await abrirLote();
    expect(botaoEm(raiz.querySelector(".pendencias__resumo")!, /^Aceitar as 0 idênticas/).disabled).toBe(true);
    desmontarTudo();
    simularLote([], { resumo: { abertas: 0 } });
    const vazia = await abrirLote();
    expect(vazia.querySelector(".pendencias__resumo")).toBeNull();
  });

  it("erro ao ler o resumo é só um aviso: a lista de pendências continua", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/resumo-sugestoes")) return respostaJson({ erro: { codigo: "ERRO_INTERNO", mensagem: "Falha ao calcular." } }, 500);
        if (url.startsWith("/api/v1/icms-saidas/regras")) return respostaJson(REGRAS);
        return url.includes("/pendencias?") ? comTotal(MISTA, 4) : respostaJson({});
      }),
    );
    const raiz = await abrirLote();
    expect(raiz.textContent).toContain("Não foi possível ler o resumo das pendências");
    expect(raiz.textContent).toContain("PRODUTO 1");
  });

  it("'Baixar planilha de todas as pendências' busca a planilha completa no motor", async () => {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => "blob:x");
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
    const { gets } = simularLote(MISTA);
    const fetchado = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>);
    const raiz = await abrirLote();
    await agir(() => botaoEm(raiz, "Baixar planilha de todas as pendências").click());
    expect(fetchado.mock.calls.some(([u]) => String(u) === "/api/v1/icms-saidas/empresas/0001/pendencias/exportar")).toBe(true);
    expect(gets.length).toBeGreaterThan(0);
    expect(raiz.querySelector('.ajuda__botao[aria-label="Ajuda: Planilha das pendências"]')).toBeTruthy();
  });

  it("em 'Todas' não há resumo nem pedido do panorama ao motor", async () => {
    simularLote(MISTA);
    const raiz = await abrirLote();
    const fetchado = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const antes = fetchado.mock.calls.filter(([u]) => String(u).includes("resumo-sugestoes")).length;
    await agir(() => [...raiz.querySelectorAll<HTMLElement>("button, [role=radio]")].find((b) => b.textContent === "Todas")!.click());
    expect(raiz.querySelector(".pendencias__resumo")).toBeNull();
    expect(fetchado.mock.calls.filter(([u]) => String(u).includes("resumo-sugestoes")).length).toBe(antes);
  });
});

describe("Pendências – item que já está na memória e sobrescrever", () => {
  it("padrão: não sobrescreve, e a mensagem diz que o item foi MANTIDO", async () => {
    const { posts } = simularLote(MISTA, {
      respostaPost: () => ({ resolvidas: 2, adicionadas: 1, sobrescritas: 0, mantidas: 1, ja_tratadas: 0, lote_id: "x" }),
    });
    const raiz = await abrirLote();
    await agir(() => botaoEm(raiz, /^Selecionar idênticas/).click());
    const marca = raiz.querySelector<HTMLInputElement>(".pendencias__lote .pendencias__sobrescrever input")!;
    expect(marca.checked).toBe(false); // o padrão é a memória atual permanecer
    await agir(() => botaoEm(raiz, /^Aceitar sugestão das selecionadas/).click());
    expect(posts[0].corpo.sobrescrever).toBe(false);
    expect(raiz.textContent).toContain("2 pendências resolvidas: 1 cadastrada na memória; 1 já estava na memória e foi mantida como está.");
  });

  it("marcando 'Sobrescrever', envia true e a mensagem diz quantas foram sobrescritas", async () => {
    const { posts } = simularLote(MISTA, {
      respostaPost: () => ({ resolvidas: 2, adicionadas: 1, sobrescritas: 1, mantidas: 0, ja_tratadas: 0, lote_id: "x" }),
    });
    const raiz = await abrirLote();
    await agir(() => botaoEm(raiz, /^Selecionar idênticas/).click());
    await agir(() => raiz.querySelector<HTMLInputElement>(".pendencias__lote .pendencias__sobrescrever input")!.click());
    await agir(() => botaoEm(raiz, /^Aceitar sugestão das selecionadas/).click());
    expect(posts[0].corpo.sobrescrever).toBe(true);
    expect(raiz.textContent).toContain("2 pendências resolvidas: 1 cadastrada na memória; 1 sobrescrita.");
  });
});

describe("Pendências – paginação com total", () => {
  it("mostra 'de N' e a página, e 'Próxima' pede o bloco seguinte ao motor", async () => {
    const pagina = Array.from({ length: 100 }, (_, i) => P(i + 1, { sugestoes: [], sugestao_aceitavel: null }));
    const { gets } = simularLote(pagina, { total: 250 });
    const raiz = await abrirLote();
    const nav = raiz.querySelector("nav.paginacao")!;
    expect(nav.textContent).toContain("1–100 de 250 · página 1 de 3");
    await agir(() => botaoEm(nav, "Próxima").click());
    expect(gets[gets.length - 1]).toContain("offset=100");
    expect(raiz.querySelector("nav.paginacao")!.textContent).toContain("101–200 de 250 · página 2 de 3");
  });

  it("na última página 'Próxima' fica desabilitada mesmo com a página cheia", async () => {
    const pagina = Array.from({ length: 100 }, (_, i) => P(i + 1, { sugestoes: [], sugestao_aceitavel: null }));
    simularLote(pagina, { total: 100 });
    const raiz = await abrirLote();
    expect(raiz.querySelector("nav.paginacao")).toBeNull(); // 100 de 100: cabe numa página, sem paginação
    desmontarTudo();
    simularLote(pagina, { total: 200 });
    const duas = await abrirLote();
    const nav = duas.querySelector("nav.paginacao")!;
    await agir(() => botaoEm(nav, "Próxima").click());
    expect(botaoEm(duas.querySelector("nav.paginacao")!, "Próxima").disabled).toBe(true);
  });
});
