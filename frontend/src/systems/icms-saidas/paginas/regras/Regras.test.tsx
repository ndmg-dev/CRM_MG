// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { agir, ComSessao, desmontarTudo, montar, respostaJson } from "../../testes/dom";
import type { ConteudoRegras, RascunhoRegras, VersaoRegrasResumo } from "../../tipos";
import { Regras } from "./Regras";

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

afterEach(() => {
  desmontarTudo();
  vi.unstubAllGlobals();
});

const CONTEUDO: ConteudoRegras = {
  grupos: [
    { nome: "NORMAL", modo: "PERCENTUAL", rbc_interna: 1, aliq_interna: 0.205, rbc_interestadual: 1, aliq_interestadual: 0.12, cst_esperados: ["00"] },
    { nome: "ANEXO II", modo: "PERCENTUAL", rbc_interna: 0.2732, aliq_interna: 0.205, rbc_interestadual: 0.5833, aliq_interestadual: 0.12, cst_esperados: ["20"] },
    { nome: "ST", modo: "ST", rbc_interna: null, aliq_interna: null, rbc_interestadual: null, aliq_interestadual: null, cst_esperados: ["60", "10"] },
  ],
  categorias: [
    { nome: "NORMAL", grupo: "NORMAL" },
    { nome: "ST", grupo: "ST" },
  ],
  aliases: [{ texto: "RBC 27,32%", categoria: "NORMAL" }],
  cfops: [{ cfop: "5102", tratamento: "VENDA", descricao: "Venda" }],
  parametros: { tolerancia: 0.05, aliquotas_validas: [0, 4, 7, 12, 20.5], base_legal_st_interestadual: "art. 33" },
};

const SEM_RASCUNHO: RascunhoRegras = {
  existe: false,
  versao_atual: 3,
  base_versao: 3,
  desatualizado: false,
  alterado_por: null,
  atualizado_em: null,
  conteudo: CONTEUDO,
  diferencas: {},
  n_alteracoes: 0,
  bloqueios: [],
  requer_confirmacao: [],
};

const COM_RASCUNHO: RascunhoRegras = {
  ...SEM_RASCUNHO,
  existe: true,
  alterado_por: "web:tiago",
  atualizado_em: "2026-10-30T14:00:00Z",
  conteudo: { ...CONTEUDO, parametros: { ...CONTEUDO.parametros, tolerancia: 0.1 } },
  diferencas: {
    categorias: { novos: [], alterados: [], removidos: [{ nome: "USO", grupo: "SÓ ENTRADA" }] },
    parametros: { alterados: [{ chave: "tolerancia", antes: 0.05, depois: 0.1 }] },
  },
  n_alteracoes: 2,
  requer_confirmacao: ["parâmetro tolerancia"],
};

const VERSOES: VersaoRegrasResumo[] = [
  { numero: 3, tipo: "MUDANCA", vigencia_inicio: "2026-10-01", resumo: "Tolerância", publicado_por: "web:tiago", criado_em: "2026-10-30T12:00:00Z", n_alteracoes: 1 },
  { numero: 1, tipo: "INICIAL", vigencia_inicio: null, resumo: "Regras iniciais", publicado_por: "sistema", criado_em: "2026-10-30T10:00:00Z", n_alteracoes: 0 },
];

type Chamada = { metodo: string; url: string; corpo: Record<string, unknown> | null };

function simular(rascunho: RascunhoRegras, opcoes: { previa?: Partial<RascunhoRegras> } = {}) {
  const chamadas: Chamada[] = [];
  let atual = rascunho;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? "GET";
      const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      chamadas.push({ metodo, url, corpo });
      if (metodo === "PUT") {
        atual = { ...atual, existe: true, conteudo: corpo!.conteudo as ConteudoRegras, n_alteracoes: 1 };
        return respostaJson(atual);
      }
      if (url.endsWith("/publicar")) return respostaJson({ ...VERSOES[0], numero: 4, diferencas: {}, conteudo: CONTEUDO, periodos: [] }, 200);
      if (url.endsWith("/descartar")) return respostaJson({});
      if (url.includes("/regras/rascunho?vigencia_inicio")) return respostaJson({ ...atual, ...opcoes.previa });
      if (url.startsWith("/api/v1/icms-saidas/regras/rascunho")) return respostaJson(atual);
      if (url.startsWith("/api/v1/icms-saidas/regras/versoes")) return respostaJson(VERSOES);
      if (url.startsWith("/api/v1/icms-saidas/regras/historico")) return respostaJson([]);
      return respostaJson({});
    }),
  );
  return chamadas;
}

async function abrir(papel: "admin" | "analista" = "admin", aba = "") {
  const raiz = await montar(
    <ComSessao papel={papel} url={`/regras${aba ? `?aba=${aba}` : ""}`}>
      <Regras />
    </ComSessao>,
  );
  await agir(() => {});
  await agir(() => {});
  return raiz;
}

const botao = (raiz: ParentNode, texto: string | RegExp) =>
  [...raiz.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    typeof texto === "string" ? b.textContent?.trim() === texto : texto.test(b.textContent ?? ""),
  );
const dialogoAberto = () => document.querySelector<HTMLDialogElement>("dialog[open]")!;

function digitar(campo: HTMLInputElement | HTMLTextAreaElement, texto: string) {
  const proto = campo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(campo, texto);
  campo.dispatchEvent(new Event("input", { bubbles: true }));
}
function escolher(campo: HTMLSelectElement, valor: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(campo, valor);
  campo.dispatchEvent(new Event("change", { bubbles: true }));
}
const enviar = (dialogo: HTMLDialogElement) => agir(() => botao(dialogo, /^Salvar no rascunho$/)!.click());

describe("Regras – analista", () => {
  it("consulta as tabelas sem botões de edição nem de publicação", async () => {
    simular(COM_RASCUNHO);
    const raiz = await abrir("analista");
    expect(raiz.textContent).toContain("Você não tem permissão para alterar as regras.");
    expect(raiz.querySelector("table")!.textContent).toContain("NORMAL");
    expect(botao(raiz, "Adicionar categoria")).toBeUndefined();
    expect(botao(raiz, /Editar/)).toBeUndefined();
    expect(botao(raiz, /Publicar/)).toBeUndefined();
    expect(raiz.querySelector(".barra-acoes")!.textContent).toContain("Rascunho com 2 alterações");
  });

  it("mostra RBC e alíquota como percentual exato e parâmetros só para leitura", async () => {
    simular(SEM_RASCUNHO);
    let raiz = await abrir("analista", "grupos");
    const linha = [...raiz.querySelectorAll("tbody tr")].find((tr) => tr.textContent?.includes("ANEXO II"))!;
    expect(linha.textContent).toContain("27,32%");
    expect(linha.textContent).toContain("58,33%");
    desmontarTudo();
    raiz = await abrir("analista", "parametros");
    expect(raiz.querySelector("form")).toBeNull();
    expect(raiz.textContent).toContain("R$ 0,05");
    expect(raiz.textContent).toContain("0%; 4%; 7%; 12%; 20,5%");
  });
});

describe("Regras – admin", () => {
  it("adiciona categoria: grava o rascunho inteiro com base_versao", async () => {
    const chamadas = simular(SEM_RASCUNHO);
    const raiz = await abrir();
    expect(raiz.querySelector(".barra-acoes")).toBeNull(); // sem rascunho, sem faixa
    await agir(() => botao(raiz, "Adicionar categoria")!.click());
    const d = dialogoAberto();
    digitar(d.querySelector("input")!, "RBC 70,59%");
    escolher(d.querySelector("select")!, "ANEXO II");
    await enviar(d);
    const put = chamadas.find((c) => c.metodo === "PUT")!;
    expect(put.url).toBe("/api/v1/icms-saidas/regras/rascunho");
    expect(put.corpo!.base_versao).toBe(3);
    const conteudo = put.corpo!.conteudo as ConteudoRegras;
    expect(conteudo.categorias.at(-1)).toEqual({ nome: "RBC 70,59%", grupo: "ANEXO II" });
    expect(conteudo.grupos).toEqual(CONTEUDO.grupos); // as outras tabelas vão junto, intactas
    expect(raiz.querySelector(".barra-acoes")!.textContent).toContain("Rascunho com 1 alteração");
  });

  it("edita grupo: 58,33% é gravado como a fração exata 0.5833", async () => {
    const chamadas = simular(SEM_RASCUNHO);
    const raiz = await abrir("admin", "grupos");
    await agir(() => raiz.querySelector<HTMLButtonElement>('button[aria-label="Editar ANEXO II"]')!.click());
    const d = dialogoAberto();
    const rbcInterestadual = [...d.querySelectorAll("label")].find((l) => l.textContent?.startsWith("RBC interestadual"))!.querySelector("input")!;
    expect(rbcInterestadual.value).toBe("58,33");
    digitar(rbcInterestadual, "58,34");
    await enviar(d);
    const grupos = (chamadas.find((c) => c.metodo === "PUT")!.corpo!.conteudo as ConteudoRegras).grupos;
    expect(grupos[1]).toEqual({ ...CONTEUDO.grupos[1], rbc_interestadual: 0.5834 });
    expect(grupos.length).toBe(3);
  });

  it("remove CFOP direto no rascunho", async () => {
    const chamadas = simular(SEM_RASCUNHO);
    const raiz = await abrir("admin", "cfops");
    await agir(() => raiz.querySelector<HTMLButtonElement>('button[aria-label="Remover 5102"]')!.click());
    expect((chamadas.find((c) => c.metodo === "PUT")!.corpo!.conteudo as ConteudoRegras).cfops).toEqual([]);
  });

  it("erro do motor fica dentro do diálogo e nada fecha", async () => {
    simular(SEM_RASCUNHO);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "PUT"
          ? respostaJson({ erro: { codigo: "REGRAS_INVALIDAS", mensagem: "Regras inválidas.", detalhes: ["cfops[1].cfop: duplicado"] } }, 422)
          : respostaJson(SEM_RASCUNHO),
      ),
    );
    const raiz = await abrir("admin", "cfops");
    await agir(() => botao(raiz, "Adicionar CFOP")!.click());
    const d = dialogoAberto();
    digitar(d.querySelector("input")!, "5102");
    await enviar(d);
    expect(d.hasAttribute("open")).toBe(true);
    expect(d.textContent).toContain("Regras inválidas.");
  });

  it("publicar: resumo das diferenças, confirmação obrigatória e mudança datada consulta os bloqueios da data", async () => {
    const chamadas = simular(COM_RASCUNHO);
    const raiz = await abrir();
    await agir(() => botao(raiz, "Publicar…")!.click());
    const d = dialogoAberto();
    expect(d.textContent).toContain("USO → SÓ ENTRADA");
    expect(d.textContent).toContain("R$ 0,05");
    expect(d.textContent).toContain("R$ 0,1");
    const publicar = botao(d, "Publicar v4")!;
    expect(publicar.getAttribute("aria-disabled")).toBe("true"); // falta confirmar o impacto
    await agir(() => d.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(publicar.hasAttribute("aria-disabled")).toBe(false);

    await agir(() => [...d.querySelectorAll<HTMLInputElement>('input[type="radio"]')][1].click());
    expect(publicar.getAttribute("aria-disabled")).toBe("true"); // falta o mês
    await agir(() => {
      const mes = d.querySelector<HTMLInputElement>(".regras__vigencia input[type='text']")!;
      digitar(mes, "11/2026");
      mes.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    await agir(() => {});
    expect(chamadas.some((c) => c.url === "/api/v1/icms-saidas/regras/rascunho?vigencia_inicio=2026-11")).toBe(true);
    expect(d.textContent).toContain("a partir de 11/2026");

    await agir(() => botao(d, "Publicar v4")!.click());
    const post = chamadas.find((c) => c.url === "/api/v1/icms-saidas/regras/rascunho/publicar")!;
    expect(post.corpo).toEqual({ tipo: "MUDANCA", vigencia_inicio: "2026-11", resumo: "", confirmar_impacto: true });
    expect(raiz.textContent).toContain("Regras v4 publicadas");
  });

  it("bloqueios impedem publicar e aparecem em destaque", async () => {
    simular({ ...COM_RASCUNHO, bloqueios: ["Categoria USO em uso na memória – 194 itens."] });
    const raiz = await abrir();
    expect(raiz.querySelector('.alerta[data-tipo="bloqueio"]')!.textContent).toContain("194 itens");
    await agir(() => botao(raiz, "Publicar…")!.click());
    expect(botao(dialogoAberto(), "Publicar v4")!.getAttribute("aria-disabled")).toBe("true");
  });

  it("rascunho desatualizado: só descartar", async () => {
    const chamadas = simular({ ...COM_RASCUNHO, desatualizado: true });
    const raiz = await abrir();
    expect(raiz.textContent).toContain("Rascunho desatualizado");
    expect(botao(raiz, "Publicar…")!.getAttribute("aria-disabled")).toBe("true");
    expect(botao(raiz, "Adicionar categoria")).toBeUndefined();
    await agir(() => botao(raiz, "Descartar")!.click());
    const d = dialogoAberto();
    digitar(d.querySelector("textarea")!, "refazer");
    await agir(() => botao(d, "Descartar rascunho")!.click());
    expect(chamadas.find((c) => c.url === "/api/v1/icms-saidas/regras/rascunho/descartar")!.corpo).toEqual({ motivo: "refazer" });
    expect(raiz.textContent).toContain("Rascunho descartado");
  });

  it("histórico lista as versões com a vigência", async () => {
    simular(SEM_RASCUNHO);
    const raiz = await abrir("admin", "historico");
    const texto = raiz.querySelector("table")!.textContent!;
    expect(texto).toContain("v3");
    expect(texto).toContain("Mudança a partir de 10/2026");
    expect(texto).toContain("Regras iniciais");
  });
});
