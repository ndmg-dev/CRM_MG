// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { agir, desmontarTudo, montar, respostaJson } from "../../testes/dom";
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

describe("Resolver pendência (sem sugestão)", () => {
  it("não tem campo de mês e envia só a tributação (item novo vale para todos os meses)", async () => {
    const raiz = await montar(<AbaPendencias codigo="0001" />);
    await agir(() => {});
    // sem sugestão na memória: cai no grupo "Sem sugestão", com a pendência aberta ao lado
    expect(raiz.querySelector(".fila__detalhe")?.textContent).toContain("Nada parecido na memória desta NCM");
    expect(raiz.querySelector('input[type="month"]')).toBeNull();

    const select = raiz.querySelector<HTMLSelectElement>(".fila__outra select")!;
    // categorias das regras globais (não há mais config por empresa), com o grupo quando difere do nome
    expect(chamadas.some((c) => c.url === "/api/v1/icms-saidas/regras")).toBe(true);
    expect([...select.options].map((o) => o.textContent)).toEqual(["Escolha…", "RBC 42,93% / 73,33% (ANEXO I)", "ST"]);
    const gravar = [...raiz.querySelectorAll("button")].find((b) => b.textContent === "Gravar na memória")!;
    expect(gravar.disabled).toBe(true); // sem escolher a tributação não grava
    await agir(() => {
      select.value = "ST";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await agir(() => gravar.click());

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

type Config = { previa?: (minimo: number) => Record<string, unknown>; falharNoPost?: number; total?: number; resumo?: Partial<ResumoSugestoes>; respostaPost?: (corpo: Record<string, unknown>, url: string) => Record<string, unknown> };

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
  const previas: number[] = [];
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
      if (url.includes("/pendencias/previa-sugestoes")) {
        const minimo = Number(new URL(url, "http://x").searchParams.get("similaridade_minima"));
        previas.push(minimo);
        if (cfg.previa) return respostaJson(cfg.previa(minimo));
        return respostaJson({ abertas: lista.length, aceitaveis: 0, identicas: 0, parecidas: 0, ficam_para_conferir: lista.length });
      }
      if (url.includes("/pendencias/resumo-sugestoes")) return respostaJson(resumoDe(lista, cfg.resumo));
      if (url.includes("/pendencias/exportar")) return new Response(new Blob(["xlsx"]), { status: 200, headers: { "Content-Type": "application/octet-stream" } });
      if (url.includes("/pendencias?")) {
        gets.push(url);
        return comTotal(lista, cfg.total ?? lista.length);
      }
      return respostaJson({});
    }),
  );
  return { gets, posts, previas };
}

async function abrirLote() {
  const raiz = await montar(<AbaPendencias codigo="0001" />);
  await agir(() => {});
  return raiz;
}

const botao = (raiz: HTMLElement, texto: string | RegExp) =>
  [...raiz.querySelectorAll<HTMLButtonElement>("button")].find((b) => (typeof texto === "string" ? b.textContent?.trim() === texto : texto.test(b.textContent ?? "")))!;
const caixa = (raiz: HTMLElement, rotulo: string) => raiz.querySelector<HTMLInputElement>(`input[aria-label="${rotulo}"]`)!;

const MISTA = [
  P(1, { sugestoes: [sugestao("IDENTICO", "ST")], sugestao_aceitavel: sugestao("IDENTICO", "ST") }),
  P(2, { sugestoes: [sugestao("PARECIDO", "NORMAL", "PARAFUSO 1/4 X 2 ZINCADO")], sugestao_aceitavel: null }),
  P(3, { sugestoes: [], sugestao_aceitavel: null }),
  P(4, { sugestoes: [sugestao("IDENTICO", "NORMAL", "TUBO PVC")], sugestao_aceitavel: sugestao("IDENTICO", "NORMAL", "TUBO PVC") }),
];

const marcadasLote = (raiz: HTMLElement) => [...raiz.querySelectorAll<HTMLInputElement>(".lote__lista input[type=checkbox]")].map((c) => c.checked);
const grupo = (raiz: HTMLElement, nome: RegExp) => botao(raiz, nome);
const abrirLoteModo = async (raiz: HTMLElement) => agir(() => botao(raiz, "Em lote").click());
const escolher = async (raiz: HTMLElement, tributacao: string) =>
  agir(() => [...raiz.querySelectorAll<HTMLButtonElement>(".lote__opcoes button")].find((b) => b.textContent === tributacao)!.click());
const detalhe = (raiz: HTMLElement) => raiz.querySelector(".fila__detalhe")!;
const tecla = (alvo: Element, key: string) => agir(() => void alvo.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));

describe("Pendências – fila de trabalho", () => {
  it("pede as sugestões ao motor, agrupa pelo que fazer e abre o primeiro item do primeiro grupo com trabalho", async () => {
    const { gets } = simularLote(MISTA);
    const raiz = await abrirLote();
    expect(gets[0]).toContain("sugestoes=true");
    expect(grupo(raiz, /^Pode aceitar/).textContent).toBe("Pode aceitar2");
    expect(grupo(raiz, /^Conferir/).textContent).toBe("Conferir1");
    expect(grupo(raiz, /^Sem sugestão/).textContent).toBe("Sem sugestão1");
    expect(grupo(raiz, /^Pode aceitar/).getAttribute("aria-pressed")).toBe("true");
    const itens = [...raiz.querySelectorAll(".fila__item")].map((l) => l.textContent ?? "");
    expect(itens).toHaveLength(2);
    expect(itens[0]).toContain("PRODUTO 1");
    expect(itens[1]).toContain("PRODUTO 4");
    expect(detalhe(raiz).textContent).toContain("PRODUTO 1");
    expect(detalhe(raiz).textContent).toContain("Idêntico");
    expect(detalhe(raiz).textContent).toContain("Este produto já está na memória.");
    expect(raiz.querySelector('.ajuda__botao[aria-label="Ajuda: Sugestão da memória"]')).toBeTruthy();
  });

  it("começa pelo grupo 'Conferir' quando não há nada seguro para aceitar", async () => {
    simularLote([MISTA[1], MISTA[2]]);
    const raiz = await abrirLote();
    expect(grupo(raiz, /^Conferir/).getAttribute("aria-pressed")).toBe("true");
    expect(detalhe(raiz).textContent).toContain("PRODUTO 2");
  });

  it("no grupo 'Conferir' destaca SÓ as palavras que mudam entre o produto e a sugestão", async () => {
    const parecida = P(9, { sugestoes: [sugestao("PARECIDO", "NORMAL", "PARAFUSO 1/4 X 2 ZINCADO")], sugestao_aceitavel: null }, );
    simularLote([{ ...parecida, descricao: "PARAFUSO 1/4 X 2" }]);
    const raiz = await abrirLote();
    const marcas = [...detalhe(raiz).querySelectorAll("mark")].map((m) => m.textContent?.trim());
    expect(marcas).toEqual(["ZINCADO"]);
    expect(detalhe(raiz).textContent).toContain("Parecido 80%");
    expect(detalhe(raiz).textContent).toContain("Produtos parecidos na memória. O destaque mostra o que muda.");
  });

  it("'Usar ST' cadastra com a tributação do item sugerido e diz o que fez", async () => {
    const { posts } = simularLote(MISTA);
    const raiz = await abrirLote();
    await agir(() => botao(detalhe(raiz) as HTMLElement, "Usar ST").click());
    expect(posts).toEqual([{ url: "/api/v1/icms-saidas/empresas/0001/pendencias/1/resolver", corpo: { tributacao: "ST" } }]);
    expect(raiz.textContent).toContain("PRODUTO 1 (NCM 73181500) cadastrado na memória como ST, a mesma tributação de PARAFUSO 1/4 X 2.");
  });

  it("as setas trocam o item aberto; Enter usa a sugestão SÓ no grupo 'Pode aceitar'", async () => {
    const { posts } = simularLote(MISTA);
    const raiz = await abrirLote();
    const lista = raiz.querySelector(".fila__lista")!;
    await tecla(lista, "ArrowDown");
    expect(detalhe(raiz).textContent).toContain("PRODUTO 4");
    await tecla(lista, "ArrowUp");
    expect(detalhe(raiz).textContent).toContain("PRODUTO 1");
    await tecla(lista, "Enter");
    expect(posts).toEqual([{ url: "/api/v1/icms-saidas/empresas/0001/pendencias/1/resolver", corpo: { tributacao: "ST" } }]);
  });

  it("Enter não aceita nada no grupo 'Conferir' (parecido exige o clique)", async () => {
    const { posts } = simularLote(MISTA);
    const raiz = await abrirLote();
    await agir(() => grupo(raiz, /^Conferir/).click());
    await tecla(raiz.querySelector(".fila__lista")!, "Enter");
    expect(posts).toEqual([]);
  });

  it("a busca filtra só a página carregada, por descrição ou NCM", async () => {
    simularLote(MISTA);
    const raiz = await abrirLote();
    const campo = raiz.querySelector<HTMLInputElement>("#busca-fila")!;
    const digitar = (valor: string) =>
      agir(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, valor);
        campo.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await digitar("produto 4");
    expect([...raiz.querySelectorAll(".fila__item")].map((l) => l.textContent)).toEqual([expect.stringContaining("PRODUTO 4")]);
    await digitar("nada disso");
    expect(raiz.textContent).toContain("Nenhuma pendência desta página combina com a busca.");
  });

  it("descartar pede o motivo e envia só com ele", async () => {
    const { posts } = simularLote(MISTA);
    const raiz = await abrirLote();
    await agir(() => botao(detalhe(raiz) as HTMLElement, "Descartar").click());
    const enviar = botao(raiz, "Descartar pendência");
    expect(enviar.disabled).toBe(true);
    const motivo = raiz.querySelector<HTMLInputElement>(".fila__descarte input")!;
    await agir(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(motivo, "  produto fora de linha ");
      motivo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await agir(() => botao(raiz, "Descartar pendência").click());
    expect(posts).toEqual([{ url: "/api/v1/icms-saidas/empresas/0001/pendencias/1/descartar", corpo: { motivo: "produto fora de linha" } }]);
    expect(raiz.textContent).toContain("Pendência de PRODUTO 1 (NCM 73181500) descartada.");
  });

  it("erro do motor numa ação fica na tela e nada some da fila", async () => {
    simularLote(MISTA, 1);
    const raiz = await abrirLote();
    await agir(() => botao(detalhe(raiz) as HTMLElement, "Usar ST").click());
    expect(raiz.textContent).toContain("LOTE_BLOQUEADO");
    expect(raiz.querySelectorAll(".fila__item")).toHaveLength(2);
  });

  it("em 'Todas' vira histórico: sem fila, sem modos e sem barra de lote; o motor não recebe 'sugestoes'", async () => {
    const { gets } = simularLote(MISTA);
    const raiz = await abrirLote();
    const todas = [...raiz.querySelectorAll<HTMLButtonElement>("button, [role=radio]")].find((b) => b.textContent === "Todas")!;
    await agir(() => todas.click());
    expect(gets[gets.length - 1]).not.toContain("sugestoes");
    expect(raiz.querySelector(".fila")).toBeNull();
    expect(raiz.querySelector(".lote")).toBeNull();
    expect(raiz.querySelector('input[type="checkbox"]')).toBeNull();
    expect(raiz.querySelector("table")?.textContent).toContain("PRODUTO 1");
  });
});

describe("Pendências – aplicar em lote", () => {
  it("passo a passo: escolher a tributação, marcar os que a sugestão indica e aplicar; envia só os marcados", async () => {
    const { posts, gets } = simularLote(MISTA);
    const raiz = await abrirLote();
    await abrirLoteModo(raiz);
    expect(botao(raiz, "Aplicar").disabled).toBe(true); // sem tributação e sem marcas
    await escolher(raiz, "NORMAL");
    expect(botao(raiz, /^Marcar os que a sugestão indica/).textContent).toBe("Marcar os que a sugestão indica (2)"); // P2 e P4 sugerem NORMAL
    await agir(() => botao(raiz, /^Marcar os que a sugestão indica/).click());
    expect(marcadasLote(raiz)).toEqual([false, true, false, true]);
    expect(raiz.querySelector(".lote__resumo")?.textContent).toBe("2 marcados · R$ 241,00");
    const antes = gets.length;
    await agir(() => botao(raiz, "Aplicar NORMAL a 2").click());
    expect(posts).toEqual([
      {
        url: "/api/v1/icms-saidas/empresas/0001/pendencias/resolver-lote",
        corpo: { resolucoes: [{ pendencia_id: 2, tributacao: "NORMAL" }, { pendencia_id: 4, tributacao: "NORMAL" }], sobrescrever: false },
      },
    ]);
    expect(raiz.textContent).toContain("2 pendências resolvidas: 2 cadastradas na memória.");
    expect(gets.length).toBeGreaterThan(antes); // a lista é recarregada
  });

  it("a tributação escolhida vale para o que a pessoa marcar, mesmo sem sugestão ou com sugestão diferente (e avisa)", async () => {
    const { posts } = simularLote(MISTA);
    const raiz = await abrirLote();
    await abrirLoteModo(raiz);
    await escolher(raiz, "NORMAL");
    await agir(() => caixa(raiz, "Selecionar PRODUTO 3").click()); // sem sugestão
    expect(raiz.querySelector(".lote__aviso")).toBeNull();
    await agir(() => caixa(raiz, "Selecionar PRODUTO 1").click()); // a sugestão dele é ST
    expect(raiz.querySelector(".lote__aviso")?.textContent).toBe("1 tem sugestão diferente de NORMAL. Confira antes de aplicar.");
    await agir(() => botao(raiz, "Aplicar NORMAL a 2").click());
    expect(posts[0].corpo).toEqual({ resolucoes: [{ pendencia_id: 1, tributacao: "NORMAL" }, { pendencia_id: 3, tributacao: "NORMAL" }], sobrescrever: false });
  });

  it("sem tributação escolhida ou sem marcas, nada é enviado; 'Limpar marcas' desmarca tudo", async () => {
    const { posts } = simularLote(MISTA);
    const raiz = await abrirLote();
    await abrirLoteModo(raiz);
    await agir(() => caixa(raiz, "Selecionar PRODUTO 2").click());
    expect(botao(raiz, "Aplicar").disabled).toBe(true); // marcou, mas não escolheu a tributação
    await agir(() => botao(raiz, "Aplicar").click());
    await escolher(raiz, "ST");
    await agir(() => botao(raiz, "Limpar marcas").click());
    expect(marcadasLote(raiz)).toEqual([false, false, false, false]);
    expect(botao(raiz, "Aplicar").disabled).toBe(true);
    expect(posts).toEqual([]);
  });

  it("só as tributações cadastradas nas regras aparecem como opção", async () => {
    simularLote(MISTA);
    const raiz = await abrirLote();
    await abrirLoteModo(raiz);
    expect([...raiz.querySelectorAll(".lote__opcoes button")].map((b) => b.textContent)).toEqual(["NORMAL", "ST"]);
  });

  it("450 marcadas vão em dois blocos (400 + 50), cada um um lote do motor", async () => {
    const muitas = Array.from({ length: 450 }, (_, i) => P(i + 1, { sugestoes: [sugestao("IDENTICO", "NORMAL")], sugestao_aceitavel: sugestao("IDENTICO", "NORMAL") }));
    const { posts } = simularLote(muitas);
    const raiz = await abrirLote();
    await abrirLoteModo(raiz);
    await escolher(raiz, "NORMAL");
    await agir(() => botao(raiz, /^Marcar os que a sugestão indica/).click());
    await agir(() => botao(raiz, /^Aplicar NORMAL a 450/).click());
    expect(posts.map((p) => (p.corpo.resolucoes as unknown[]).length)).toEqual([400, 50]);
    expect(raiz.textContent).toContain("450 pendências resolvidas: 450 cadastradas na memória.");
  });

  it("se o segundo bloco falha, mostra o erro do motor e quantas já foram resolvidas", async () => {
    const muitas = Array.from({ length: 450 }, (_, i) => P(i + 1, { sugestoes: [sugestao("IDENTICO", "NORMAL")], sugestao_aceitavel: sugestao("IDENTICO", "NORMAL") }));
    const { posts } = simularLote(muitas, 2);
    const raiz = await abrirLote();
    await abrirLoteModo(raiz);
    await escolher(raiz, "NORMAL");
    await agir(() => botao(raiz, /^Marcar os que a sugestão indica/).click());
    await agir(() => botao(raiz, /^Aplicar NORMAL a 450/).click());
    expect(posts).toHaveLength(2);
    expect(raiz.textContent).toContain("LOTE_BLOQUEADO");
    expect(raiz.textContent).toContain("O lote das pendências foi bloqueado pelas travas da memória.");
    expect(raiz.textContent).toContain("400 pendências resolvidas: 400 cadastradas na memória — antes do erro.");
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
  async function marcarEAplicar(raiz: HTMLElement) {
    await abrirLoteModo(raiz);
    await escolher(raiz, "NORMAL");
    await agir(() => botao(raiz, /^Marcar os que a sugestão indica/).click());
  }

  it("padrão: não sobrescreve, e a mensagem diz que o item foi MANTIDO", async () => {
    const { posts } = simularLote(MISTA, {
      respostaPost: () => ({ resolvidas: 2, adicionadas: 1, sobrescritas: 0, mantidas: 1, ja_tratadas: 0, lote_id: "x" }),
    });
    const raiz = await abrirLote();
    await marcarEAplicar(raiz);
    const marca = raiz.querySelector<HTMLInputElement>(".lote__sobrescrever input")!;
    expect(marca.checked).toBe(false); // o padrão é a memória atual permanecer
    await agir(() => botao(raiz, /^Aplicar NORMAL/).click());
    expect(posts[0].corpo.sobrescrever).toBe(false);
    expect(raiz.textContent).toContain("2 pendências resolvidas: 1 cadastrada na memória; 1 já estava na memória e foi mantida como está.");
  });

  it("marcando 'Trocar a tributação…', envia true e a mensagem diz quantas foram sobrescritas", async () => {
    const { posts } = simularLote(MISTA, {
      respostaPost: () => ({ resolvidas: 2, adicionadas: 1, sobrescritas: 1, mantidas: 0, ja_tratadas: 0, lote_id: "x" }),
    });
    const raiz = await abrirLote();
    await marcarEAplicar(raiz);
    await agir(() => raiz.querySelector<HTMLInputElement>(".lote__sobrescrever input")!.click());
    await agir(() => botao(raiz, /^Aplicar NORMAL/).click());
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


// ------------------------------------------------------------------------------- aceitar a sugestão do sistema em todas as pendências

const PREVIA = (m: number) =>
  m >= 0.9
    ? { abertas: 402, aceitaveis: 60, identicas: 2, parecidas: 58, ficam_para_conferir: 342 }
    : { abertas: 402, aceitaveis: 377, identicas: 2, parecidas: 375, ficam_para_conferir: 25 };
const RESUMO_COM_SUGESTOES = { abertas: 402, identicas_aceitaveis: 2, parecidas: 375, sem_sugestao: 25 };
const abrirDialogoTodas = async (raiz: HTMLElement) => agir(() => botaoEm(raiz.querySelector(".pendencias__resumo")!, "Aceitar a sugestão em todas").click());
const dialogoTodas = (raiz: HTMLElement) => raiz.querySelector("dialog[open]")!;
const mudarMinimo = async (raiz: HTMLElement, valor: string) =>
  agir(() => {
    const select = raiz.querySelector<HTMLSelectElement>("dialog[open] select")!;
    select.value = valor;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

describe("Pendências – aceitar a sugestão do sistema em todas", () => {
  it("abre pedindo a prévia com o padrão 'qualquer sugestão' e mostra o que vai ser cadastrado e o que fica para conferir", async () => {
    const { previas, posts } = simularLote(MISTA, { resumo: RESUMO_COM_SUGESTOES, previa: PREVIA });
    const raiz = await abrirLote();
    expect(previas).toEqual([]); // fechado, não consulta o motor
    await abrirDialogoTodas(raiz);
    const d = dialogoTodas(raiz);
    expect(previas).toEqual([0]);
    expect(d.querySelector<HTMLSelectElement>("select")!.value).toBe("0");
    expect(d.textContent).toContain("Vai cadastrar 377 pendências (2 idênticas e 375 parecidas)");
    expect(d.textContent).toContain("25 ficam para conferir");
    expect(d.textContent).toContain("parecido não é igual");
    expect(botaoEm(d, "Cadastrar 377 na memória")).toBeTruthy();
    expect(posts).toEqual([]); // abrir não grava nada
  });

  it("trocar o mínimo atualiza a contagem na hora e o envio leva esse mínimo", async () => {
    const { previas, posts } = simularLote(MISTA, {
      resumo: RESUMO_COM_SUGESTOES, previa: PREVIA,
      respostaPost: () => ({ resolvidas: 60, adicionadas: 60, sobrescritas: 0, mantidas: 0, ja_tratadas: 0, lote_id: "x", encontradas: 60, restantes: 0, identicas: 2, parecidas: 58 }),
    });
    const raiz = await abrirLote();
    await abrirDialogoTodas(raiz);
    await mudarMinimo(raiz, "0.9");
    expect(previas).toEqual([0, 0.9]);
    expect(dialogoTodas(raiz).textContent).toContain("Vai cadastrar 60 pendências (2 idênticas e 58 parecidas)");
    await agir(() => botaoEm(dialogoTodas(raiz), "Cadastrar 60 na memória").click());
    expect(posts).toEqual([{ url: "/api/v1/icms-saidas/empresas/0001/pendencias/aceitar-sugestoes", corpo: { similaridade_minima: 0.9, sobrescrever: false } }]);
    expect(raiz.textContent).toContain("60 pendências resolvidas: 60 cadastradas na memória (2 idênticas e 58 parecidas).");
    expect(raiz.querySelector("dialog[open]")).toBeNull();
  });

  it("não manda lista de pendências: só o mínimo e o sobrescrever (quem escolhe quais é o motor)", async () => {
    const { posts } = simularLote(MISTA, {
      resumo: RESUMO_COM_SUGESTOES, previa: PREVIA,
      respostaPost: () => ({ resolvidas: 377, adicionadas: 377, sobrescritas: 0, mantidas: 0, ja_tratadas: 0, lote_id: "x", encontradas: 377, restantes: 0, identicas: 2, parecidas: 375 }),
    });
    const raiz = await abrirLote();
    await abrirDialogoTodas(raiz);
    await agir(() => raiz.querySelector<HTMLInputElement>("dialog[open] input[type=checkbox]")!.click());
    await agir(() => botaoEm(dialogoTodas(raiz), /^Cadastrar/).click());
    expect(Object.keys(posts[0].corpo).sort()).toEqual(["similaridade_minima", "sobrescrever"]);
    expect(posts[0].corpo).toEqual({ similaridade_minima: 0, sobrescrever: true });
  });

  it("avisa quando sobraram para uma próxima rodada (limite por lote)", async () => {
    simularLote(MISTA, {
      resumo: RESUMO_COM_SUGESTOES, previa: () => ({ abertas: 6000, aceitaveis: 6000, identicas: 100, parecidas: 5900, ficam_para_conferir: 0 }),
      respostaPost: () => ({ resolvidas: 5000, adicionadas: 5000, sobrescritas: 0, mantidas: 0, ja_tratadas: 0, lote_id: "x", encontradas: 6000, restantes: 1000, identicas: 100, parecidas: 4900 }),
    });
    const raiz = await abrirLote();
    await abrirDialogoTodas(raiz);
    await agir(() => botaoEm(dialogoTodas(raiz), /^Cadastrar/).click());
    expect(raiz.textContent).toContain("5.000 pendências resolvidas");
    expect(raiz.textContent).toContain("Ainda há 1.000 pendências para aceitar: repita a ação.");
  });

  it("sem nada aceitável com esse mínimo, o botão de gravar fica indisponível e Cancelar não envia", async () => {
    const { posts } = simularLote(MISTA, { resumo: RESUMO_COM_SUGESTOES, previa: () => ({ abertas: 402, aceitaveis: 0, identicas: 0, parecidas: 0, ficam_para_conferir: 402 }) });
    const raiz = await abrirLote();
    await abrirDialogoTodas(raiz);
    const gravar = botaoEm(dialogoTodas(raiz), /^Cadastrar/);
    expect(gravar.disabled).toBe(true);
    await agir(() => gravar.click());
    await agir(() => botaoEm(dialogoTodas(raiz), "Cancelar").click());
    expect(posts).toEqual([]);
    expect(raiz.querySelector("dialog[open]")).toBeNull();
  });

  it("o botão fica indisponível quando não há idêntica nem parecida em nenhuma página", async () => {
    simularLote(MISTA, { resumo: { abertas: 5, identicas_aceitaveis: 0, parecidas: 0, sem_sugestao: 5 } });
    const raiz = await abrirLote();
    expect(botaoEm(raiz.querySelector(".pendencias__resumo")!, "Aceitar a sugestão em todas").disabled).toBe(true);
  });

  it("erro do motor ao gravar aparece no resumo com o código", async () => {
    simularLote(MISTA, { resumo: RESUMO_COM_SUGESTOES, previa: PREVIA, falharNoPost: 1 });
    const raiz = await abrirLote();
    await abrirDialogoTodas(raiz);
    await agir(() => botaoEm(dialogoTodas(raiz), /^Cadastrar/).click());
    expect(raiz.textContent).toContain("LOTE_BLOQUEADO");
  });

  it("erro ao calcular a prévia aparece no diálogo e não deixa gravar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/previa-sugestoes")) return respostaJson({ erro: { codigo: "ERRO_INTERNO", mensagem: "Falha ao calcular." } }, 500);
        if (url.includes("/resumo-sugestoes")) return respostaJson(RESUMO_COM_SUGESTOES);
        if (url.startsWith("/api/v1/icms-saidas/regras")) return respostaJson(REGRAS);
        return url.includes("/pendencias?") ? comTotal(MISTA, 4) : respostaJson({});
      }),
    );
    const raiz = await abrirLote();
    await abrirDialogoTodas(raiz);
    expect(dialogoTodas(raiz).textContent).toContain("Falha ao calcular.");
    expect(botaoEm(dialogoTodas(raiz), /^Cadastrar/).disabled).toBe(true);
  });
});
