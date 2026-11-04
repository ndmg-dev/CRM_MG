// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { agir, desmontarTudo, montar, respostaJson } from "../testes/dom";
import { useCriarPastas } from "./CriarPastas";

function CriarPastas() {
  const { acao, retorno } = useCriarPastas();
  return (
    <>
      {acao}
      {retorno}
    </>
  );
}

const chamadas: { url: string; init: RequestInit }[] = [];
let resposta: () => Response;

beforeEach(() => {
  chamadas.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return resposta();
    }),
  );
});

afterEach(() => {
  desmontarTudo();
  vi.unstubAllGlobals();
});

function botao(raiz: HTMLElement): HTMLButtonElement {
  return [...raiz.querySelectorAll("button")].find((b) => b.textContent?.includes("Criar pastas no Drive"))!;
}

describe("Criar pastas no Drive", () => {
  it("chama o BFF (nunca o n8n direto) e mostra a mensagem", async () => {
    resposta = () => respostaJson({ situacao: "disparado", mensagem: "Pastas solicitadas." }, 202);
    const raiz = await montar(<CriarPastas />);
    await agir(() => botao(raiz).click());
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("/api/v1/icms-saidas/drive/preparar-pastas");
    expect(chamadas[0].init.method).toBe("POST");
    expect(raiz.querySelector('[role="status"]')?.textContent).toContain("Pastas solicitadas.");
    expect(raiz.querySelector('.ajuda__botao')?.getAttribute("aria-expanded")).toBe("false");
  });

  it("mostra o erro do BFF quando a integração não está configurada", async () => {
    resposta = () =>
      respostaJson(
        { erro: { codigo: "INTEGRACAO_DESATIVADA", mensagem: "A integração com o Drive (n8n) não está configurada.", detalhes: [] } },
        503,
      );
    const raiz = await montar(<CriarPastas />);
    await agir(() => botao(raiz).click());
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain("não está configurada");
    expect(raiz.querySelector('[role="status"]')).toBeNull();
  });
});
