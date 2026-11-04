import { afterEach, describe, expect, it } from "vitest";

import { assinar, comCarregamento, iniciarCarregamento, lerEntradas, textoDaRequisicao } from "./carregando";

afterEach(() => {
  // nenhum teste pode deixar a tela travada para o seguinte
  expect(lerEntradas()).toHaveLength(0);
});

describe("estado do carregamento", () => {
  it("liga ao iniciar e desliga ao encerrar; encerrar duas vezes não desliga a operação dos outros", () => {
    const a = iniciarCarregamento("A");
    const b = iniciarCarregamento("B");
    expect(lerEntradas().map((e) => e.texto)).toEqual(["A", "B"]);
    a();
    a(); // idempotente
    expect(lerEntradas().map((e) => e.texto)).toEqual(["B"]);
    b();
  });

  it("avisa quem assinou a cada mudança e devolve uma referência nova (useSyncExternalStore)", () => {
    let avisos = 0;
    const parar = assinar(() => avisos++);
    const antes = lerEntradas();
    const fim = iniciarCarregamento("X");
    expect(lerEntradas()).not.toBe(antes);
    fim();
    expect(avisos).toBe(2);
    parar();
    iniciarCarregamento("Y")();
    expect(avisos).toBe(2); // depois de cancelar a assinatura, não recebe mais
  });

  it("comCarregamento desliga ao terminar, também quando a operação falha", async () => {
    await expect(comCarregamento("ok", async () => 7)).resolves.toBe(7);
    await expect(
      comCarregamento("falha", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(lerEntradas()).toHaveLength(0);
  });

  it("enquanto a operação roda, o texto está ligado", async () => {
    let liberar: () => void = () => {};
    const espera = comCarregamento("Lendo…", () => new Promise<void>((ok) => (liberar = ok)));
    expect(lerEntradas().map((e) => e.texto)).toEqual(["Lendo…"]);
    liberar();
    await espera;
  });
});

describe("texto de cada operação", () => {
  const base = "/api/empresas/0001";
  const id = "3f1c2b7e-8a8b-4d1c-9c55-2b8f0e6d1a10";
  it.each([
    ["GET", `${base}/memoria/lotes/${id}/problemas`, "Lendo o arquivo do lote… pode levar alguns segundos."],
    ["PUT", `${base}/memoria/lotes/${id}/correcoes`, "Gravando as correções e reavaliando o lote…"],
    ["POST", `${base}/memoria/lotes/${id}/reavaliar`, "Reavaliando o lote…"],
    ["POST", `${base}/memoria/lotes/${id}/aprovar`, "Gravando na memória…"],
    ["GET", `${base}/memoria/lotes/${id}`, "Carregando o lote…"],
    ["GET", `${base}/memoria/lotes/${id}/diferencas?limit=500&offset=0`, "Carregando as diferenças do lote…"],
    ["POST", `${base}/memoria/lotes`, "Comparando a planilha com a memória atual…"],
    ["POST", `${base}/memoria/completar`, "Lendo a memória e os relatórios de saídas… pode levar alguns segundos por arquivo."],
    ["POST", `${base}/apuracoes`, "Processando a apuração… pode levar alguns segundos."],
    ["POST", `${base}/pendencias/resolver-lote`, "Gravando as pendências na memória…"],
    ["POST", `${base}/pendencias/aceitar-identicas`, "Gravando as pendências na memória…"],
    ["POST", `${base}/pendencias/7/resolver`, "Gravando as pendências na memória…"],
    ["GET", `${base}/pendencias/resumo-sugestoes`, "Calculando o resumo das pendências…"],
    ["GET", `${base}/pendencias?status=ABERTA&sugestoes=true`, "Buscando sugestões na memória…"],
    ["GET", `${base}/pendencias/exportar`, "Gerando a planilha das pendências…"],
    ["PATCH", `${base}`, "Salvando…"],
    ["GET", "/api/empresas", "Carregando…"],
  ])("%s %s", (metodo, caminho, esperado) => {
    expect(textoDaRequisicao(metodo, caminho)).toBe(esperado);
  });
});
