// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { agir, ComSessao, desmontarTudo, montar, respostaJson } from "../testes/dom";
import type { PainelItem } from "../tipos";
import { Painel } from "./Painel";

afterEach(() => {
  desmontarTudo();
  vi.unstubAllGlobals();
});

const ITENS: PainelItem[] = [
  { empresa: "0001", razao_social: "Mercadinho São João", situacao: "CONCLUIDA", apuracao_id: "a1", od: 100, ed: 30, pendencias: { produtos_sem_cadastro: 0, itens_cfop_nao_parametrizado: 0, itens_conferencia_manual: 0 }, pendencias_abertas: 0 },
  { empresa: "0002", razao_social: "Distribuidora Recife", situacao: "CONCLUIDA_COM_PENDENCIAS", apuracao_id: "a2", od: 50, ed: 10, pendencias: { produtos_sem_cadastro: 3, itens_cfop_nao_parametrizado: 2, itens_conferencia_manual: 0 }, pendencias_abertas: 3 },
  { empresa: "0003", razao_social: "Atacado Olinda", situacao: "SEM_APURACAO", apuracao_id: null, od: null, ed: null, pendencias: null, pendencias_abertas: 0 },
  { empresa: "0004", razao_social: "Farmácia Boa Vista", situacao: "ERRO", apuracao_id: "a4", od: null, ed: null, pendencias: null, pendencias_abertas: 0 },
];

function simular(resposta: () => Promise<Response>) {
  const fetch = vi.fn<(url: string) => Promise<Response>>(() => resposta());
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function abrir(papel: "admin" | "analista" = "admin", url = "/?competencia=2026-09") {
  const raiz = await montar(
    <ComSessao papel={papel} url={url}>
      <Painel />
    </ComSessao>,
  );
  await agir(() => {});
  return raiz;
}

const linhas = (raiz: HTMLElement) => [...raiz.querySelectorAll<HTMLTableRowElement>("tbody tr")];
const celulaPendencias = (linha: HTMLTableRowElement) => linha.cells[4].textContent;
const codigos = (raiz: HTMLElement) => linhas(raiz).map((l) => l.querySelector(".painel__codigo")?.textContent);

describe("Painel do mês", () => {
  it("sucesso: busca a competência da URL, mostra MM/AAAA, totais com saldo e pendências por origem", async () => {
    const fetch = simular(async () => respostaJson(ITENS));
    const raiz = await abrir();
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/icms-saidas/painel?competencia=2026-09");
    expect(raiz.querySelector(".seletor-competencia__atual")?.textContent).toBe("09/2026");
    expect(raiz.textContent).toContain("Soma das 2 apurações concluídas");
    expect(raiz.textContent).toContain("Não é o ICMS a recolher");
    expect(raiz.querySelector(".resumo-mes__titulo")?.textContent).toBe("1 de 4 empresas concluídas sem pendências");

    // Ordem de atenção: erro, com pendências, sem apuração e, por último, concluída.
    expect(codigos(raiz)).toEqual(["0004", "0002", "0003", "0001"]);
    const [erro, pendencias, semApuracao, concluida] = linhas(raiz);
    expect(celulaPendencias(concluida)).toBe("—");
    expect(celulaPendencias(pendencias)).toBe("Produtos: 3CFOP: 2");
    expect(celulaPendencias(erro)).toBe("Ver detalhes do erro");
    expect(concluida.querySelector(".painel__razao")?.getAttribute("href")).toBe("/sistemas/teste/empresas/0001?competencia=2026-09");
    const apurar = semApuracao.querySelector(".botao");
    expect(apurar?.textContent).toBe("Apurar");
    expect(apurar?.getAttribute("href")).toBe("/sistemas/teste/empresas/0003?competencia=2026-09&aba=apurar");
    expect(concluida.querySelector(".botao")).toBeNull();
    expect(pendencias.cells[2].textContent).toBe("50,00");
    expect(raiz.querySelector("tfoot")?.textContent).toContain("Total · 2 apurações concluídas");
  });

  it("'Concluída com pendências' nunca aparece com '—' (só CFOP; ou, por defesa, sem contagem nenhuma)", async () => {
    const soCfop = ITENS.map((i) => ({ ...i }));
    soCfop[1].pendencias = { produtos_sem_cadastro: 0, itens_cfop_nao_parametrizado: 4, itens_conferencia_manual: 0 };
    simular(async () => respostaJson(soCfop));
    const raiz = await abrir();
    expect(celulaPendencias(linhas(raiz)[1])).toBe("CFOP: 4");
    desmontarTudo();

    const semContagem = ITENS.map((i) => ({ ...i }));
    semContagem[1].pendencias = { produtos_sem_cadastro: 0, itens_cfop_nao_parametrizado: 0, itens_conferencia_manual: 0 };
    simular(async () => respostaJson(semContagem));
    const outra = await abrir();
    for (const linha of linhas(outra)) {
      if (linha.cells[1].textContent === "Concluída com pendências") expect(celulaPendencias(linha)).toBe("Ver na apuração");
    }
  });

  it("carregando: texto em role=status, esqueletos e seletor usável", async () => {
    simular(() => new Promise(() => {}));
    const raiz = await abrir();
    expect(raiz.querySelector('[role="status"]')?.textContent).toBe("Carregando apurações de 09/2026…");
    expect(raiz.querySelectorAll(".tabela__esqueleto")).toHaveLength(6);
    expect(raiz.querySelectorAll(".cartao-total__esqueleto")).toHaveLength(3);
    expect(raiz.querySelector<HTMLButtonElement>(".seletor-competencia__atual")!.disabled).toBe(false);
  });

  it("erro: alerta com competência, 'Nenhum dado foi alterado', código e 'Tentar de novo'; totais ocultos", async () => {
    let falhar = true;
    simular(async () =>
      falhar ? respostaJson({ erro: { codigo: "MOTOR_INDISPONIVEL", mensagem: "Motor fora do ar.", detalhes: [] } }, 502) : respostaJson(ITENS),
    );
    const raiz = await abrir();
    const alerta = raiz.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain("Não foi possível carregar o painel de 09/2026");
    expect(alerta.textContent).toContain("Nenhum dado foi alterado.");
    expect(alerta.textContent).toContain("MOTOR_INDISPONIVEL");
    expect(raiz.querySelector(".cartao-total")).toBeNull();

    falhar = false;
    await agir(() => [...alerta.querySelectorAll("button")].find((b) => b.textContent === "Tentar de novo")!.click());
    await agir(() => {});
    expect(raiz.querySelector('[role="alert"]')).toBeNull();
    expect(linhas(raiz)).toHaveLength(4);
  });

  it("vazio: admin vê 'Cadastrar primeira empresa'; analista é orientado a pedir e não vê 'Nova empresa'", async () => {
    simular(async () => respostaJson([]));
    const admin = await abrir("admin");
    expect(admin.textContent).toContain("Nenhuma empresa cadastrada");
    expect(admin.textContent).toContain("Cadastrar primeira empresa");
    expect(admin.querySelector(".cartao-total")).toBeNull();
    desmontarTudo();

    const analista = await abrir("analista");
    expect(analista.textContent).toContain("Peça a quem administra o módulo");
    expect(analista.textContent).not.toContain("Nova empresa");
    expect(analista.textContent).not.toContain("Cadastrar primeira empresa");
  });

  it("filtro sem resultado: mensagem com o termo e 'Limpar filtros'", async () => {
    simular(async () => respostaJson(ITENS));
    const raiz = await abrir();
    const campo = raiz.querySelector<HTMLInputElement>('input[type="search"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await agir(() => {
      setter.call(campo, "sao joao");
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(linhas(raiz)).toHaveLength(1); // sem acento acha "São João"

    await agir(() => {
      setter.call(campo, "zzz");
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(raiz.textContent).toContain("Nenhuma empresa corresponde a ‘zzz’");
    await agir(() => [...raiz.querySelectorAll("button")].find((b) => b.textContent === "Limpar filtros")!.click());
    expect(linhas(raiz)).toHaveLength(4);
  });

  it("chips de situação com aria-pressed filtram a tabela", async () => {
    simular(async () => respostaJson(ITENS));
    const raiz = await abrir();
    const erro = [...raiz.querySelectorAll<HTMLButtonElement>(".grupo-filtro__opcao")].find((b) => b.textContent?.startsWith("Erro"))!;
    expect(erro.getAttribute("aria-pressed")).toBe("false");
    await agir(() => erro.click());
    expect(erro.getAttribute("aria-pressed")).toBe("true");
    expect(codigos(raiz)).toEqual(["0004"]);
  });
});
