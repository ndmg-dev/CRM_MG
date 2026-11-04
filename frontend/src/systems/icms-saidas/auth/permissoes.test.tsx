// @vitest-environment jsdom
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { agir, desmontarTudo, montar, respostaJson } from "../testes/dom";
import { PERMISSOES, ProvedorPermissoes, RequerAdmin, RequerPermissao } from "./permissoes";

afterEach(() => {
  desmontarTudo();
  vi.unstubAllGlobals();
});

function com(resposta: () => Promise<Response>) {
  const fetch = vi.fn<(url: string) => Promise<Response>>(() => resposta());
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function abrir(filho: React.ReactNode) {
  return montar(
    <MemoryRouter>
      <ProvedorPermissoes>{filho}</ProvedorPermissoes>
    </MemoryRouter>,
  );
}

describe("ProvedorPermissoes / RequerPermissao", () => {
  it("lê as permissões de GET /icms-saidas/eu e libera só o que foi concedido", async () => {
    const fetch = com(async () => respostaJson({ admin: false, permissoes: [PERMISSOES.consultar, PERMISSOES.operar] }));
    const raiz = await abrir(
      <>
        <RequerPermissao permissao={PERMISSOES.operar}>
          <p>pode operar</p>
        </RequerPermissao>
        <RequerPermissao permissao={PERMISSOES.aprovarLotes}>
          <p>pode aprovar</p>
        </RequerPermissao>
      </>,
    );
    await agir(() => {});
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/icms-saidas/eu");
    expect(raiz.textContent).toContain("pode operar");
    expect(raiz.textContent).not.toContain("pode aprovar");
    expect(raiz.querySelector("[role=alert]")?.textContent).toContain("não tem permissão");
  });

  it("falha ao ler as permissões = nenhuma permissão (nunca libera por engano)", async () => {
    com(async () => respostaJson({ erro: { codigo: "ERRO", mensagem: "x", detalhes: [] } }, 500));
    const raiz = await abrir(
      <RequerPermissao permissao={PERMISSOES.consultar}>
        <p>conteúdo</p>
      </RequerPermissao>,
    );
    await agir(() => {});
    expect(raiz.textContent).not.toContain("conteúdo");
    expect(raiz.querySelector("[role=alert]")).not.toBeNull();
  });

  it("RequerAdmin: só ADMIN do CRM entra", async () => {
    com(async () => respostaJson({ admin: false, permissoes: Object.values(PERMISSOES) }));
    const comum = await abrir(
      <RequerAdmin>
        <p>tela de permissões</p>
      </RequerAdmin>,
    );
    await agir(() => {});
    expect(comum.textContent).not.toContain("tela de permissões");
    desmontarTudo();

    com(async () => respostaJson({ admin: true, permissoes: Object.values(PERMISSOES) }));
    const admin = await abrir(
      <RequerAdmin>
        <p>tela de permissões</p>
      </RequerAdmin>,
    );
    await agir(() => {});
    expect(admin.textContent).toContain("tela de permissões");
  });
});
