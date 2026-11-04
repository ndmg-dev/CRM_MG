// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, baixar, ErroApi, requisitar } from "./api";
import { lerEntradas } from "./ui/carregando";

afterEach(() => {
  vi.unstubAllGlobals();
  expect(lerEntradas()).toHaveLength(0); // toda requisição, com sucesso ou erro, solta a tela de carregamento
});

const texto = () => lerEntradas().map((e) => e.texto);

function fetchControlado() {
  let responder: (r: Response) => void = () => {};
  let falhar: (e: unknown) => void = () => {};
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((ok, ruim) => ((responder = ok), (falhar = ruim)))));
  return { responder: (r: Response) => responder(r), falhar: (e: unknown) => falhar(e) };
}

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

describe("api.ts liga a tela de carregamento", () => {
  it("enquanto espera a resposta, com o texto da operação, e solta ao terminar", async () => {
    const f = fetchControlado();
    const pedido = api.get("/api/empresas/0001/memoria/lotes/3f1c2b7e-8a8b-4d1c-9c55-2b8f0e6d1a10/problemas");
    expect(texto()).toEqual(["Lendo o arquivo do lote… pode levar alguns segundos."]);
    f.responder(json({ ok: true }));
    await expect(pedido).resolves.toEqual({ ok: true });
  });

  it("continua ligada enquanto o corpo da resposta é lido (não solta só com os cabeçalhos)", async () => {
    let liberarCorpo: () => void = () => {};
    const corpoLento = new Promise<void>((ok) => (liberarCorpo = ok));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => (await corpoLento, { lido: true }) })));
    const pedido = api.get("/api/empresas");
    await Promise.resolve();
    await Promise.resolve();
    expect(texto()).toEqual(["Carregando…"]);
    liberarCorpo();
    await expect(pedido).resolves.toEqual({ lido: true });
  });

  it("solta também quando o motor devolve erro e quando a rede cai", async () => {
    const f = fetchControlado();
    const erro = api.put("/api/empresas/0001/memoria/lotes/x/correcoes", { correcoes: [] });
    expect(texto()).toEqual(["Gravando as correções e reavaliando o lote…"]);
    f.responder(json({ erro: { codigo: "CATEGORIA_INEXISTENTE", mensagem: "x", detalhes: [] } }, 422));
    await expect(erro).rejects.toBeInstanceOf(ErroApi);

    const g = fetchControlado();
    const rede = api.post("/api/empresas/0001/pendencias/resolver-lote", {});
    expect(texto()).toEqual(["Gravando as pendências na memória…"]);
    g.falhar(new TypeError("Failed to fetch"));
    await expect(rede).rejects.toMatchObject({ codigo: "SEM_CONEXAO" });
  });

  it("envio de arquivo (multipart) também liga, com o texto de comparar a planilha", async () => {
    const f = fetchControlado();
    const envio = api.enviar("/api/empresas/0001/memoria/lotes", new FormData());
    expect(texto()).toEqual(["Comparando a planilha com a memória atual…"]);
    f.responder(json({}));
    await envio;
  });

  it("requisitar() (usada por hooks) liga durante a espera", async () => {
    const f = fetchControlado();
    const r = requisitar("GET", "/api/empresas/0001/pendencias?status=ABERTA&sugestoes=true");
    expect(texto()).toEqual(["Buscando sugestões na memória…"]);
    f.responder(json([]));
    await r;
  });

  it("baixar() fica ligada até ler o arquivo inteiro, e entrega o download", async () => {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => "blob:x");
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
    let liberarArquivo: () => void = () => {};
    const arquivoLento = new Promise<void>((ok) => (liberarArquivo = ok));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, headers: new Headers({ "content-disposition": 'attachment; filename="P.xlsx"' }), blob: async () => (await arquivoLento, new Blob(["x"])) })),
    );
    const baixando = baixar("/api/empresas/0001/pendencias/exportar", "padrao.xlsx");
    await Promise.resolve();
    await Promise.resolve();
    expect(texto()).toEqual(["Gerando a planilha das pendências…"]);
    liberarArquivo();
    await baixando;
    expect((URL as unknown as { createObjectURL: ReturnType<typeof vi.fn> }).createObjectURL).toHaveBeenCalled();
  });
});
