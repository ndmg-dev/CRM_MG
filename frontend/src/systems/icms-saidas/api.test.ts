// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, consulta, definirAoExpirar, ErroApi, urlDoCaminho } from "./api";

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

describe("api.ts", () => {
  const chamadas: { url: string; init: RequestInit }[] = [];

  beforeEach(() => {
    chamadas.length = 0;
    localStorage.setItem("crm_token", "jwt-do-crm");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        chamadas.push({ url, init });
        return respostaJson({ ok: true });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    definirAoExpirar(null);
    localStorage.clear();
  });

  it("traduz /api/... para o prefixo do módulo no backend do CRM", () => {
    expect(urlDoCaminho("/api/painel?competencia=2026-09")).toBe("/api/v1/icms-saidas/painel?competencia=2026-09");
    expect(urlDoCaminho("/api/empresas/MM/memoria/lotes")).toBe("/api/v1/icms-saidas/empresas/MM/memoria/lotes");
  });

  it("envia o token do CRM (Bearer) e o JSON em POST e PATCH, sem cookie nem CSRF", async () => {
    await api.post("/api/empresas/MM/pendencias/1/descartar", { motivo: "x" });
    await api.patch("/api/empresas/MM", { ativo: false });
    for (const { init } of chamadas) {
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer jwt-do-crm");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-CSRF-Token"]).toBeUndefined();
    }
    expect(chamadas[0].url).toBe("/api/v1/icms-saidas/empresas/MM/pendencias/1/descartar");
    expect(chamadas[0].init.method).toBe("POST");
    expect(chamadas[0].init.body).toBe(JSON.stringify({ motivo: "x" }));
  });

  it("envia o token em upload multipart sem fixar Content-Type", async () => {
    const form = new FormData();
    form.set("arquivo", new Blob(["x"]), "a.xlsx");
    await api.enviar("/api/empresas/MM/apuracoes", form);
    const headers = chamadas[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-do-crm");
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("sem token no navegador não manda Authorization", async () => {
    localStorage.clear();
    await api.get("/api/painel?competencia=2026-09");
    const headers = chamadas[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(chamadas[0].url).toBe("/api/v1/icms-saidas/painel?competencia=2026-09");
  });

  it("transforma o erro do backend em ErroApi e, no 401, avisa que a sessão do CRM venceu", async () => {
    const expirou = vi.fn();
    definirAoExpirar(expirou);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respostaJson({ erro: { codigo: "NAO_AUTENTICADO", mensagem: "Sessão inválida.", detalhes: [] } }, 401)),
    );
    const erro = await api.get("/api/painel").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).codigo).toBe("NAO_AUTENTICADO");
    expect(expirou).toHaveBeenCalledTimes(1);
  });

  it("403 de permissão não derruba a sessão e chega à tela com o código estável", async () => {
    const expirou = vi.fn();
    definirAoExpirar(expirou);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respostaJson({ erro: { codigo: "SEM_PERMISSAO", mensagem: "Sem permissão.", detalhes: ["icms_saidas.operar"] } }, 403)),
    );
    const erro = (await api.post("/api/empresas/MM/apuracoes").catch((e: unknown) => e)) as ErroApi;
    expect(erro.status).toBe(403);
    expect(erro.codigo).toBe("SEM_PERMISSAO");
    expect(erro.detalhes).toEqual(["icms_saidas.operar"]);
    expect(expirou).not.toHaveBeenCalled();
  });

  it("erro no formato padrão do FastAPI ({detail}) vira mensagem legível", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respostaJson({ detail: "Not authenticated" }, 400)));
    const erro = (await api.get("/api/painel").catch((e: unknown) => e)) as ErroApi;
    expect(erro.message).toBe("Not authenticated");
  });

  it("monta query string ignorando vazios", () => {
    expect(consulta({ competencia: "2026-09", q: "", limit: 50, x: undefined })).toBe("?competencia=2026-09&limit=50");
    expect(consulta({})).toBe("");
  });
});
