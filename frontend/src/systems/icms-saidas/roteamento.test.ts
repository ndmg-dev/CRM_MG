import { describe, expect, it } from "vitest";

import { comBase } from "./roteamento";

describe("comBase", () => {
  const base = "/sistemas/abc-123";

  it("ancora os caminhos absolutos do módulo sob /sistemas/:id", () => {
    expect(comBase(base, "/")).toBe(base);
    expect(comBase(base, "/regras")).toBe(`${base}/regras`);
    expect(comBase(base, "/empresas/0001?competencia=2026-09&aba=apurar")).toBe(`${base}/empresas/0001?competencia=2026-09&aba=apurar`);
    expect(comBase(base, "/admin/empresas/nova")).toBe(`${base}/admin/empresas/nova`);
  });

  it("não mexe em destinos que não são absolutos do módulo", () => {
    expect(comBase(base, "?aba=memoria")).toBe("?aba=memoria");
    expect(comBase(base, "https://exemplo.com/x")).toBe("https://exemplo.com/x");
  });
});
