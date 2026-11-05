// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { agir, ComSessao, desmontarTudo, enviarFormulario, escolherArquivo, montar, respostaJson } from "../../testes/dom";
import type { Apuracao } from "../../tipos";
import { AbaApurar } from "./AbaApurar";

const APURACAO: Apuracao = {
  id: "ap1",
  empresa: "0001",
  competencia: "2026-09",
  status: "CONCLUIDA_COM_PENDENCIAS",
  vigente: true,
  origem: "PORTAL",
  arquivo_entrada_nome: "SAIDAS.xlsx",
  n_itens: 13584,
  totais: {
    od: 6612.94,
    ed: 31249.68,
    saldo: -24636.74,
    pendencias: { produtos_sem_cadastro: 3, itens_cfop_nao_parametrizado: 2, itens_conferencia_manual: 0 },
  },
  erro: null,
  solicitado_por: "web:tiago",
  iniciado_em: "2026-10-29T13:00:00Z",
  concluido_em: "2026-10-29T13:00:18Z",
  planilha_url: "/v1/empresas/0001/apuracoes/ap1/planilha",
};

afterEach(() => {
  desmontarTudo();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** fetch simulado: o POST da apuração fica pendente até `resolver` ser chamado. */
function simular() {
  let resolver!: (r: Response) => void;
  const posts: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(init);
        return new Promise<Response>((r) => (resolver = r));
      }
      return Promise.resolve(respostaJson(url.includes("apenas_vigentes") ? [] : {}));
    }),
  );
  return { posts, responder: (r: Response) => resolver(r) };
}

async function preparar() {
  const raiz = await montar(
    <ComSessao>
      <AbaApurar codigo="0001" competenciaInicial="" irPara={() => {}} />
    </ComSessao>,
  );
  await agir(() => {});
  const botao = () => raiz.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  return { raiz, botao, formulario: raiz.querySelector("form")! };
}

describe("Aba Apurar", () => {
  it("vazio: botão indisponível com motivo (aria-disabled) e bloco 'O resultado aparece aqui'", async () => {
    simular();
    const { raiz, botao } = await preparar();
    expect(botao().getAttribute("aria-disabled")).toBe("true");
    expect(botao().disabled).toBe(false);
    expect(document.getElementById(botao().getAttribute("aria-describedby")!)?.textContent).toBe("Escolha o relatório de vendas (.xlsx).");
    expect(raiz.textContent).toContain("O resultado aparece aqui");
    expect(raiz.querySelector('input[type="month"]')).toBeNull();
  });

  it("duplo clique e Enter durante o processamento geram UMA requisição; formulário travado", async () => {
    const { posts, responder } = simular();
    const { raiz, botao, formulario } = await preparar();
    await agir(() => escolherArquivo(raiz.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["x"], "SAIDAS.xlsx")));

    await agir(() => {
      botao().click();
      botao().click();
      enviarFormulario(formulario);
    });
    expect(posts).toHaveLength(1);
    expect(botao().disabled).toBe(true);
    expect(botao().getAttribute("aria-busy")).toBe("true");
    expect(botao().textContent).toContain("Processando… 0 s");
    expect(raiz.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(true);
    expect(raiz.querySelector('[aria-live="polite"]')?.textContent).toBe("Processando a apuração…");
    expect(raiz.textContent).toContain("Tempo decorrido: 0 s de cerca de 20 s");

    await agir(() => responder(respostaJson(APURACAO, 201)));
    expect(posts).toHaveLength(1);
    expect(raiz.querySelector('[aria-live="polite"]')?.textContent).toBe("Apuração concluída.");
  });

  it("sucesso: OD/ED em destaque, saldo com 'Não é o ICMS a recolher', origens das pendências e Baixar planilha", async () => {
    const { responder } = simular();
    const { raiz, botao } = await preparar();
    await agir(() => escolherArquivo(raiz.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["x"], "SAIDAS.xlsx")));
    await agir(() => botao().click());
    await agir(() => responder(respostaJson(APURACAO, 201)));

    expect(raiz.textContent).toContain("Apuração de 09/2026");
    expect(raiz.textContent).toContain("Não é o ICMS a recolher");
    expect(raiz.textContent).toContain("Valor a acrescentar");
    expect(raiz.textContent).toContain("Por que ‘com pendências’?");
    expect([...raiz.querySelectorAll(".chip--origem")].map((c) => c.textContent)).toEqual(["Produtos: 3", "CFOP: 2"]);
    expect([...raiz.querySelectorAll("button")].some((b) => b.textContent === "Baixar planilha")).toBe(true);
    expect(raiz.textContent).toContain("por Tiago");
    // arquivo mantido e formulário reabilitado
    expect(raiz.querySelector(".envio__nome")?.textContent).toBe("SAIDAS.xlsx");
    expect(raiz.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(false);
  });

  it("erro: detalhes da API, 'Nenhuma planilha foi gerada' e botão 'Tentar de novo com este arquivo'", async () => {
    const { responder } = simular();
    const { raiz, botao } = await preparar();
    await agir(() => escolherArquivo(raiz.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["x"], "SAIDAS.xlsx")));
    await agir(() => botao().click());
    await agir(() =>
      responder(respostaJson({ erro: { codigo: "ARQUIVO_INVALIDO", mensagem: "Arquivo inválido.", detalhes: ["linha 3: CFOP vazio"] } }, 422)),
    );
    const alerta = raiz.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain("A apuração não foi processada");
    expect(alerta.textContent).toContain("Nenhuma planilha foi gerada.");
    expect(alerta.querySelector("summary")?.textContent).toBe("Detalhes (1)");
    expect(botao().textContent).toBe("Tentar de novo com este arquivo");
    expect(raiz.querySelector('[aria-live="polite"]')?.textContent).toBe("Apuração não processada.");
  });

  it("passando de 40 s avisa que está demorando, sem porcentagem", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    simular();
    const { raiz, botao } = await preparar();
    await agir(() => escolherArquivo(raiz.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["x"], "SAIDAS.xlsx")));
    await agir(() => botao().click());
    act(() => {
      vi.advanceTimersByTime(41_000);
    });
    expect(raiz.textContent).toContain("Está demorando mais que o normal; continue aguardando.");
    expect(raiz.textContent).not.toMatch(/\d+\s?%/);
  });
});

// ------------------------------------------------------------------------------------------- apuração parcial (só o que tem na memória)

const CABECALHOS_PARCIAL = {
  "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "Content-Disposition": 'attachment; filename="APURACAO_PARCIAL_07_2026_0001.xlsx"',
  "X-Parcial-Competencia": "2026-07",
  "X-Parcial-Itens": "4",
  "X-Parcial-Itens-Sem-Memoria": "1",
  "X-Parcial-Produtos-Sem-Memoria": "1",
  "X-Parcial-OD": "205.00",
  "X-Parcial-ED": "10.50",
  "X-Parcial-Saldo": "194.50",
};

function simularParcial(resposta: () => Response | Promise<Response> = () => new Response(new Blob(["xlsx"]), { status: 200, headers: CABECALHOS_PARCIAL })) {
  const posts: { url: string; corpo: FormData }[] = [];
  const baixados: string[] = [];
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => "blob:x");
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    baixados.push(this.download);
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push({ url, corpo: init.body as FormData });
        return resposta();
      }
      return respostaJson(url.includes("apenas_vigentes") ? [] : {});
    }),
  );
  return { posts, baixados };
}

const botaoParcial = (raiz: HTMLElement) => [...raiz.querySelectorAll<HTMLButtonElement>("button")].find((b) => /só o que tem na memória|^Apurando/.test(b.textContent ?? ""))!;

describe("Aba Apurar – só o que tem na memória", () => {
  it("sem arquivo fica indisponível com o mesmo motivo do botão principal", async () => {
    simularParcial();
    const { raiz } = await preparar();
    const b = botaoParcial(raiz);
    expect(b.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(b.getAttribute("aria-describedby")!)?.textContent).toBe("Escolha o relatório de vendas (.xlsx).");
    expect(raiz.querySelector('.ajuda__botao[aria-label="Ajuda: Apuração parcial"]')).toBeTruthy();
  });

  it("envia o arquivo à rota parcial, baixa a planilha e mostra o resumo sem registrar apuração", async () => {
    const { posts, baixados } = simularParcial();
    const { raiz } = await preparar();
    await agir(() => escolherArquivo(raiz.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["x"], "SAIDAS.xlsx")));
    await agir(() => botaoParcial(raiz).click());

    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("/api/v1/icms-saidas/empresas/0001/apuracoes/parcial"); // NÃO a rota da apuração completa
    expect((posts[0].corpo.get("arquivo") as File).name).toBe("SAIDAS.xlsx");
    expect(baixados).toEqual(["APURACAO_PARCIAL_07_2026_0001.xlsx"]);
    expect(raiz.textContent).toContain("Planilha parcial baixada (07/2026)");
    expect(raiz.textContent).toContain("3 de 4 itens foram calculados.");
    expect(raiz.textContent).toContain("1 item (1 produto) não tem memória e está na aba SEM MEMÓRIA.");
    expect(raiz.textContent).toContain("OD parcial R$ 205,00");
    expect(raiz.textContent).toContain("ED parcial R$ 10,50");
    expect(raiz.textContent).toContain("Esta apuração não foi registrada");
    expect(raiz.textContent).not.toContain("Ver no Histórico"); // nada foi registrado
    expect(raiz.querySelector('[aria-live="polite"]')?.textContent).toBe("Planilha parcial baixada.");
  });

  it("duplo clique gera UMA requisição e, enquanto espera, trava também o botão principal", async () => {
    let liberar!: (r: Response) => void;
    const { posts } = simularParcial(() => new Promise<Response>((r) => (liberar = r)));
    const { raiz, botao } = await preparar();
    await agir(() => escolherArquivo(raiz.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["x"], "SAIDAS.xlsx")));
    await agir(() => {
      botaoParcial(raiz).click();
      botaoParcial(raiz).click();
    });
    expect(posts).toHaveLength(1);
    expect(botao().disabled).toBe(true); // o principal não pode disparar uma segunda apuração durante a parcial
    expect(botaoParcial(raiz).textContent).toContain("Apurando… 0 s");
    expect(botaoParcial(raiz).getAttribute("aria-busy")).toBe("true");
    await agir(() => liberar(new Response(new Blob(["x"]), { status: 200, headers: CABECALHOS_PARCIAL })));
    expect(raiz.textContent).toContain("Planilha parcial baixada");
  });

  it("todos os itens com memória: diz isso em vez de falar de aba SEM MEMÓRIA", async () => {
    simularParcial(() => new Response(new Blob(["x"]), { status: 200, headers: { ...CABECALHOS_PARCIAL, "X-Parcial-Itens-Sem-Memoria": "0", "X-Parcial-Produtos-Sem-Memoria": "0" } }));
    const { raiz } = await preparar();
    await agir(() => escolherArquivo(raiz.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["x"], "SAIDAS.xlsx")));
    await agir(() => botaoParcial(raiz).click());
    expect(raiz.textContent).toContain("4 de 4 itens foram calculados. Todos os itens têm tributação na memória.");
  });

  it("erro do motor (ex.: sem memória) aparece com o código e nada é baixado", async () => {
    const { baixados } = simularParcial(() => respostaJson({ erro: { codigo: "MEMORIA_VAZIA", mensagem: "A empresa não possui memória tributária vigente.", detalhes: [] } }, 409));
    const { raiz } = await preparar();
    await agir(() => escolherArquivo(raiz.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["x"], "SAIDAS.xlsx")));
    await agir(() => botaoParcial(raiz).click());
    expect(raiz.textContent).toContain("MEMORIA_VAZIA");
    expect(raiz.textContent).toContain("A empresa não possui memória tributária vigente.");
    expect(baixados).toEqual([]);
    expect(raiz.textContent).not.toContain("Planilha parcial baixada");
  });
});
