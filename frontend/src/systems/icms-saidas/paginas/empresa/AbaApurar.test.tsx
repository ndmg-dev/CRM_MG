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
