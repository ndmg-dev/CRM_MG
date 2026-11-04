// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { agir, ComSessao, desmontarTudo, montar, respostaJson } from "../../testes/dom";
import type { Diferenca, Lote } from "../../tipos";
import { PROBLEMAS } from "./correcao.fixtures";
import { DetalheLote } from "./DetalheLote";

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

const LOTE: Lote = {
  id: "11111111-1111-1111-1111-111111111111",
  tipo: "COMPLETA",
  status: "PENDENTE_APROVACAO",
  vigencia_inicio: "2026-09-01",
  arquivo_nome: "memoria.xlsx",
  enviado_por: "web:maria",
  decidido_por: null,
  decidido_em: null,
  motivo: null,
  resumo: { itens_arquivo: 40, itens_memoria_atual: 40, incluidos: 1, removidos: 2, tributacao_alterada: 1, limite_remocao: 0.05, correcao: false },
  bloqueios: [],
  avisos: ["2 linha(s) duplicada(s) com a mesma tributação foram unificadas"],
  criado_em: "2026-10-29T12:00:00Z",
};

const DIFS: Diferenca[] = [
  { id: 1, tipo: "INCLUÍDO", item_id: null, descricao: "TUBO PVC", ncm: "39173900", icms_anterior: null, icms_novo: "ST", pis_anterior: null, pis_novo: "", aplicada: null },
  { id: 2, tipo: "TRIBUTAÇÃO ALTERADA", item_id: 120, descricao: "PARAFUSO", ncm: "73181500", icms_anterior: "NORMAL", icms_novo: "ST", pis_anterior: "", pis_novo: "", aplicada: null },
  { id: 3, tipo: "REMOVIDO", item_id: 77, descricao: "INTERRUPTOR", ncm: "85365090", icms_anterior: "ST", icms_novo: null, pis_anterior: "", pis_novo: null, aplicada: null },
  { id: 4, tipo: "REMOVIDO", item_id: 78, descricao: "TOMADA", ncm: "85365090", icms_anterior: "ST", icms_novo: null, pis_anterior: "", pis_novo: null, aplicada: null },
];

type Opcoes = { lote?: Lote; difs?: Diferenca[]; aprovar?: (corpo: Record<string, unknown>) => Response };

function simular({ lote = LOTE, difs = DIFS, aprovar }: Opcoes = {}) {
  const posts: { url: string; corpo: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const corpo = JSON.parse(String(init.body)) as Record<string, unknown>;
        posts.push({ url, corpo });
        if (url.endsWith("/aprovar") && aprovar) return aprovar(corpo);
        return respostaJson({ ...lote, status: url.endsWith("/aprovar") ? "APROVADO" : "REJEITADO" });
      }
      if (url.includes("/diferencas")) {
        const offset = Number(new URL(url, "http://x").searchParams.get("offset") ?? 0);
        return respostaJson(difs.slice(offset, offset + 500));
      }
      return respostaJson(lote);
    }),
  );
  return posts;
}

async function abrir(papel: "admin" | "analista" = "admin") {
  const raiz = await montar(
    <ComSessao papel={papel}>
      <DetalheLote base="/api/empresas/0001/memoria" id={LOTE.id} voltar={() => {}} aoDecidir={() => {}} />
    </ComSessao>,
  );
  await agir(() => {});
  await agir(() => {});
  return raiz;
}

const botao = (raiz: HTMLElement, texto: string | RegExp) =>
  [...raiz.querySelectorAll<HTMLButtonElement>("button")].find((b) => (typeof texto === "string" ? b.textContent === texto : texto.test(b.textContent ?? "")));
const caixasItens = (raiz: HTMLElement) => [...raiz.querySelectorAll<HTMLInputElement>("tbody tr:not(.lote__grupo) input[type=checkbox]")];
const statusBarra = (raiz: HTMLElement) => raiz.querySelector(".barra-acoes [role=status]")?.textContent ?? "";

function digitar(campo: HTMLInputElement, texto: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, texto);
  campo.dispatchEvent(new Event("input", { bubbles: true }));
}
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Detalhe do lote – admin", () => {
  it("abre com todos marcados (padrão atual = lote inteiro); a barra resume por tipo e acompanha a seleção", async () => {
    simular();
    const raiz = await abrir();
    expect(caixasItens(raiz).every((c) => c.checked)).toBe(true);
    expect(statusBarra(raiz)).toContain("4 de 4 itens selecionados");
    expect(statusBarra(raiz)).toContain("Novos 1 · Alterados 1 · Removidos 2");

    await agir(() => caixasItens(raiz)[0].click());
    expect(statusBarra(raiz)).toContain("3 de 4 itens selecionados");
    expect(caixasItens(raiz)[0].closest("tr")!.hasAttribute("data-desmarcada")).toBe(true);
    expect(botao(raiz, "Aplicar selecionados (3)")).toBeTruthy();
  });

  it("caixa de grupo fica mista (indeterminate) e marca/desmarca o grupo", async () => {
    simular();
    const raiz = await abrir();
    const grupoRemovidos = raiz.querySelector<HTMLInputElement>('input[aria-label="Selecionar todos os 2 removidos"]')!;
    const [, , rem1] = caixasItens(raiz);
    await agir(() => rem1.click());
    expect(grupoRemovidos.indeterminate).toBe(true);
    await agir(() => grupoRemovidos.click());
    expect(caixasItens(raiz).slice(2).every((c) => c.checked)).toBe(true);
  });

  it("antes → depois: valor antigo riscado, seta lida como 'passa a ser'; removido só com o antigo", async () => {
    simular();
    const raiz = await abrir();
    const linhaAlterada = [...raiz.querySelectorAll("tbody tr")].find((tr) => tr.textContent?.includes("PARAFUSO"))!;
    expect(linhaAlterada.querySelector("del")?.textContent).toBe("NORMAL");
    expect(linhaAlterada.querySelector("strong")?.textContent).toBe("ST");
    expect(linhaAlterada.textContent).toContain("passa a ser");
    expect(linhaAlterada.textContent).toContain("a partir de 09/2026");
    expect(linhaAlterada.textContent).toContain("120"); // ID da memória
    expect(linhaAlterada.querySelector("input")?.getAttribute("aria-label")).toBe("Incluir PARAFUSO (NCM 73181500)");
    const linhaNova = [...raiz.querySelectorAll("tbody tr")].find((tr) => tr.textContent?.includes("TUBO PVC"))!;
    expect(linhaNova.textContent).toContain("todos os meses");
    const removida = [...raiz.querySelectorAll("tbody tr")].find((tr) => tr.textContent?.includes("INTERRUPTOR"))!;
    expect(removida.querySelector(".lote__descricao del")?.textContent).toBe("INTERRUPTOR");
    expect(removida.querySelector("strong")).toBeNull();
  });

  it("aplica só a seleção, mandando a lista menor (excluir)", async () => {
    const posts = simular();
    const raiz = await abrir();
    await agir(() => caixasItens(raiz)[0].click());
    await agir(() => botao(raiz, "Aplicar selecionados (3)")!.click());
    expect(posts[0].corpo).toEqual({ confirmar_remocoes: false, excluir: [1] });
    expect(raiz.textContent).toContain("Lote aplicado: 3 itens gravados na memória.");
  });

  it("zero selecionados: Aplicar indisponível com 'Selecione ao menos um item'", async () => {
    const posts = simular();
    const raiz = await abrir();
    for (const g of raiz.querySelectorAll<HTMLInputElement>("tr.lote__grupo input")) await agir(() => g.click());
    const aplicar = botao(raiz, "Aplicar selecionados (0)")!;
    expect(aplicar.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(aplicar.getAttribute("aria-describedby")!)?.textContent).toBe("Selecione ao menos um item.");
    await agir(() => aplicar.click());
    expect(posts).toHaveLength(0);
  });

  it("remoções acima do limite: o motor pede confirmação, o diálogo exige a caixa marcada antes de aplicar", async () => {
    const posts = simular({
      aprovar: (corpo) =>
        corpo.confirmar_remocoes
          ? respostaJson({ ...LOTE, status: "APROVADO" })
          : respostaJson({ erro: { codigo: "CONFIRMACAO_NECESSARIA", mensagem: "Confirme.", detalhes: [] } }, 409),
    });
    const raiz = await abrir();
    await agir(() => botao(raiz, "Aplicar selecionados (4)")!.click());
    const dialogo = raiz.querySelector("dialog")!;
    expect(dialogo.open).toBe(true);
    expect(dialogo.textContent).toContain("Confirmar remoção de 2 itens");
    expect(dialogo.textContent).toContain("5,0% dos 40 itens da memória atual");
    expect(dialogo.textContent).toContain("(5% da memória atual)");
    expect(dialogo.textContent).toContain("Revisei os 2 itens removidos e confirmo que deixam de valer a partir de 09/2026");

    const aplicar = [...dialogo.querySelectorAll("button")].find((b) => b.textContent === "Aplicar 4 itens")!;
    expect(aplicar.getAttribute("aria-disabled")).toBe("true");
    await agir(() => aplicar.click());
    expect(posts).toHaveLength(1);

    await agir(() => dialogo.querySelector<HTMLInputElement>("input[type=checkbox]")!.click());
    expect(aplicar.isConnected).toBe(true); // mesmo botão: não perde o foco
    expect(aplicar.getAttribute("aria-disabled")).toBeNull();
    await agir(() => aplicar.click());
    expect(posts).toHaveLength(2);
    expect(posts[1].corpo).toEqual({ confirmar_remocoes: true });
  });

  it("'Voltar e revisar' fecha o diálogo e aplica o filtro Removidos", async () => {
    simular({ aprovar: () => respostaJson({ erro: { codigo: "CONFIRMACAO_NECESSARIA", mensagem: "Confirme.", detalhes: [] } }, 409) });
    const raiz = await abrir();
    await agir(() => botao(raiz, "Aplicar selecionados (4)")!.click());
    await agir(() => botao(raiz, "Voltar e revisar")!.click());
    expect(raiz.querySelector("dialog")!.open).toBe(false);
    expect(raiz.querySelector('.grupo-filtro__opcao[aria-pressed="true"]')?.textContent).toContain("Removidos");
    expect(caixasItens(raiz)).toHaveLength(2);
  });

  it("rejeitar pede motivo num diálogo", async () => {
    const posts = simular();
    const raiz = await abrir();
    await agir(() => botao(raiz, "Rejeitar lote")!.click());
    const dialogo = [...raiz.querySelectorAll("dialog")].find((d) => d.open)!;
    const confirmar = [...dialogo.querySelectorAll("button")].find((b) => b.textContent === "Rejeitar lote")!;
    await agir(() => confirmar.click());
    expect(posts).toHaveLength(0);
    const motivo = dialogo.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(motivo, "arquivo errado");
    await agir(() => motivo.dispatchEvent(new Event("input", { bubbles: true })));
    await agir(() => confirmar.click());
    expect(posts[0]).toEqual({ url: `/api/v1/icms-saidas/empresas/0001/memoria/lotes/${LOTE.id}/rejeitar`, corpo: { motivo: "arquivo errado" } });
  });
});

describe("Detalhe do lote – bloqueio", () => {
  it("bloqueio no topo, antes dos avisos; aplicar indisponível com cadeado por clique e por Enter; rejeitar disponível", async () => {
    const bloqueado = { ...LOTE, status: "BLOQUEADO", bloqueios: ["Apenas 10% dos códigos do arquivo existem na memória atual da empresa 0001. O arquivo parece ser de outra empresa."] };
    const posts = simular({ lote: bloqueado, difs: [] });
    const raiz = await abrir();
    const alerta = raiz.querySelector('[data-tipo="bloqueio"]')!;
    const aviso = raiz.querySelector('[data-tipo="aviso"]')!;
    expect(alerta.textContent).toContain("Este lote não pode ser aplicado — 1 bloqueio");
    expect(alerta.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const aplicar = botao(raiz, /^Aplicar/)!;
    expect(aplicar.getAttribute("aria-disabled")).toBe("true");
    expect(aplicar.querySelector("svg")).not.toBeNull();
    await agir(() => aplicar.click());
    await agir(() => {
      aplicar.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(posts).toHaveLength(0);
    expect(botao(raiz, "Rejeitar lote")!.getAttribute("aria-disabled")).toBeNull();
  });
});

describe("Detalhe do lote – analista", () => {
  it("somente leitura: sem caixas de seleção, sem Aplicar e sem Rejeitar", async () => {
    simular();
    const raiz = await abrir("analista");
    expect(raiz.querySelectorAll("input[type=checkbox]")).toHaveLength(0);
    expect(botao(raiz, /^Aplicar/)).toBeUndefined();
    expect(botao(raiz, "Rejeitar lote")).toBeUndefined();
    expect(raiz.textContent).toContain("Somente leitura: aplicar ou rejeitar o lote exige a permissão de aprovação de lotes.");
  });
});

describe("Detalhe do lote – filtros, busca e volume", () => {
  it("filtro por tipo e busca sem resultado com 'Limpar busca'", async () => {
    simular();
    const raiz = await abrir();
    await agir(() => botao(raiz, /^Novos/)!.click());
    expect(caixasItens(raiz)).toHaveLength(1);
    const campo = raiz.querySelector<HTMLInputElement>('input[type="search"]')!;
    await agir(() => digitar(campo, "zzz"));
    await esperar(250);
    await agir(() => {});
    expect(raiz.textContent).toContain("Nenhum item corresponde a ‘zzz’ em Novos");
    await agir(() => botao(raiz, "Limpar busca")!.click());
    await esperar(250);
    await agir(() => {});
    expect(caixasItens(raiz)).toHaveLength(4);
  });

  it("500 diferenças: 50 na tela, 'Carregar mais 50', busca no lote inteiro em menos de 300 ms", async () => {
    const muitas: Diferenca[] = Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      tipo: i % 3 === 0 ? "INCLUÍDO" : i % 3 === 1 ? "TRIBUTAÇÃO ALTERADA" : "REMOVIDO",
      item_id: i % 3 === 0 ? null : 1000 + i,
      descricao: `PRODUTO ${1000 + i}`,
      ncm: "39173900",
      icms_anterior: "NORMAL",
      icms_novo: "ST",
      pis_anterior: "",
      pis_novo: "",
      aplicada: null,
    }));
    simular({ difs: muitas, lote: { ...LOTE, resumo: { ...LOTE.resumo, itens_memoria_atual: 2000 } } });
    const raiz = await abrir();
    expect(caixasItens(raiz)).toHaveLength(50);
    expect(raiz.textContent).toContain("Mostrando 1–50 de 500");
    await agir(() => botao(raiz, "Carregar mais 50")!.click());
    expect(caixasItens(raiz)).toHaveLength(100);

    const campo = raiz.querySelector<HTMLInputElement>('input[type="search"]')!;
    const inicio = performance.now();
    await agir(() => digitar(campo, "produto 1499"));
    while (!raiz.textContent?.includes("Mostrando 1–1 de 1") && performance.now() - inicio < 1000) {
      await esperar(10);
      await agir(() => {});
    }
    const tempo = performance.now() - inicio;
    expect(raiz.textContent).toContain("Mostrando 1–1 de 1");
    expect(tempo).toBeLessThan(300);
  });
});

describe("Detalhe do lote – correção da importação (ADR-009)", () => {
  const APROVAR_LOTE = /^Aplicar(?! correções)/;
  const CORRIGIVEL: Lote = {
    ...LOTE,
    status: "BLOQUEADO",
    vigencia_inicio: "2000-01-01",
    resumo: { correcao: true, corrigivel: true, problemas: { linhas_invalidas: 2, categorias: 2, categorias_linhas: 2, conflitos: 1, total: 5 } },
    bloqueios: ["2 linha(s) com dados inválidos (ex.: linha 6: DESCRIÇÃO vazia)"],
    avisos: [],
  };

  function simularCorrecao(lote: Lote, aoGravar?: () => Lote) {
    const chamadas: { metodo: string; url: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const metodo = init?.method ?? "GET";
        chamadas.push({ metodo, url });
        if (metodo === "PUT") return respostaJson(aoGravar ? aoGravar() : lote);
        if (url.endsWith("/problemas")) return respostaJson(PROBLEMAS);
        if (url.includes("/diferencas")) return respostaJson([]);
        return respostaJson(lote);
      }),
    );
    return chamadas;
  }

  it("lote bloqueado e corrigível mostra a tela de correção no lugar de 'envie de novo'", async () => {
    simularCorrecao(CORRIGIVEL);
    const raiz = await abrir();
    const alerta = raiz.querySelector('[data-tipo="bloqueio"]')!;
    expect(alerta.textContent).toContain("Resolva os problemas abaixo (sem enviar o arquivo de novo)");
    expect(raiz.querySelector("section.correcao")).not.toBeNull();
    expect(raiz.textContent).toContain("O motor compara os itens depois que os problemas da importação forem resolvidos.");
    const aprovar = botao(raiz, APROVAR_LOTE)!; // o botão de aprovar o lote, não o "Aplicar correções" da tela nova
    expect(aprovar.getAttribute("aria-disabled")).toBe("true"); // aprovar segue indisponível
    expect(raiz.textContent).toContain("Lote bloqueado: resolva os problemas da importação.");
  });

  it("bloqueio que a tela não resolve (outra empresa) continua pedindo para corrigir o arquivo", async () => {
    simularCorrecao({ ...CORRIGIVEL, resumo: { ...CORRIGIVEL.resumo, corrigivel: false }, bloqueios: ["O arquivo parece ser de outra empresa."] });
    const raiz = await abrir();
    expect(raiz.querySelector("section.correcao")).toBeNull();
    expect(raiz.querySelector('[data-tipo="bloqueio"]')!.textContent).toContain("Corrija o arquivo e envie de novo.");
    expect(raiz.textContent).toContain("Com bloqueio, o motor não compara os itens: corrija o arquivo e envie de novo.");
  });

  it("o analista também corrige (quem envia o arquivo resolve os problemas dele); aprovar segue só do admin", async () => {
    simularCorrecao(CORRIGIVEL);
    const raiz = await abrir("analista");
    expect(raiz.querySelector("section.correcao")).not.toBeNull();
    expect(botao(raiz, "Aplicar correções")).toBeDefined();
    expect(botao(raiz, APROVAR_LOTE)).toBeUndefined(); // sem o botão de aprovar o lote
    expect(raiz.textContent).toContain("Somente leitura: aplicar ou rejeitar o lote exige a permissão de aprovação de lotes.");
  });

  it("depois de gravar, recarrega o lote e mostra a mensagem no alerta de sucesso da tela", async () => {
    const chamadas = simularCorrecao(CORRIGIVEL, () => ({ ...LOTE, status: "PENDENTE_APROVACAO" }));
    const raiz = await abrir();
    const antes = chamadas.filter((c) => c.metodo === "GET" && c.url.endsWith(`/lotes/${LOTE.id}`)).length;
    const select = raiz.querySelector<HTMLSelectElement>('select[aria-label="O que fazer com o texto ST - MONO"]')!;
    await agir(() => {
      select.value = "ignorar";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await agir(() => botao(raiz, "Aplicar correções")!.click());
    await agir(() => {});
    expect(chamadas.some((c) => c.metodo === "PUT" && c.url.endsWith(`/lotes/${LOTE.id}/correcoes`))).toBe(true);
    expect(chamadas.filter((c) => c.metodo === "GET" && c.url.endsWith(`/lotes/${LOTE.id}`)).length).toBeGreaterThan(antes);
    expect(raiz.querySelector('[data-tipo="sucesso"]')?.textContent).toContain("Correções gravadas. Sem problemas pendentes");
  });

  it("lote já corrigido (pendente de aprovação) oferece 'Rever correções' com a contagem", async () => {
    simularCorrecao({ ...LOTE, resumo: { ...LOTE.resumo, correcoes: { decisoes: 3, linhas_ignoradas: 1, linhas_mapeadas: 1, linhas_corrigidas: 1, conflitos_resolvidos: 0, sem_efeito: 0 } } });
    const raiz = await abrir();
    expect(raiz.querySelector("section.correcao")).toBeNull();
    await agir(() => botao(raiz, "Rever correções (3)")!.click());
    expect(raiz.querySelector("section.correcao")).not.toBeNull();
    expect(botao(raiz, "Rever correções (3)")).toBeUndefined();
  });

  it("lote sem decisões gravadas não mostra 'Rever correções'", async () => {
    simularCorrecao(LOTE);
    const raiz = await abrir();
    expect(raiz.textContent).not.toContain("Rever correções");
  });
});
