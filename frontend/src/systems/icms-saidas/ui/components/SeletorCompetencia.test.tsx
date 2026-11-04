// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { agir, desmontarTudo, montar, tecla } from "../../testes/dom";
import { SeletorCompetencia } from "./SeletorCompetencia";

afterEach(desmontarTudo);

function Controlado({ inicial, modo, max, aoMudar }: { inicial: string; modo?: "inline" | "campo"; max?: string; aoMudar?: (v: string) => void }) {
  const [valor, setValor] = useState(inicial);
  return (
    <SeletorCompetencia
      valor={valor}
      modo={modo}
      max={max}
      onChange={(v) => {
        setValor(v);
        aoMudar?.(v);
      }}
    />
  );
}

/** Digita num input controlado pelo React (o setter nativo dispara o onChange). */
function digitar(campo: HTMLInputElement, texto: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(campo, texto);
  campo.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("<SeletorCompetencia> inline", () => {
  it("mostra MM/AAAA e anda com ‹ ›; o próximo mês além do máximo fica desabilitado", async () => {
    const mudou = vi.fn();
    const raiz = await montar(<Controlado inicial="2026-08" max="2026-09" aoMudar={mudou} />);
    const [anterior, atual, proximo] = [...raiz.querySelectorAll<HTMLButtonElement>(".seletor-competencia > button")];
    expect(atual.textContent).toBe("08/2026");
    expect(anterior.getAttribute("aria-label")).toBe("Mês anterior (07/2026)");
    await agir(() => proximo.click());
    expect(mudou).toHaveBeenLastCalledWith("2026-09");
    expect(atual.textContent).toBe("09/2026");
    expect(proximo.disabled).toBe(true);
  });

  it("popover: foco no mês atual, setas movem, Enter escolhe, Esc fecha e devolve o foco; futuros desabilitados", async () => {
    const mudou = vi.fn();
    const raiz = await montar(<Controlado inicial="2026-08" max="2026-09" aoMudar={mudou} />);
    const atual = raiz.querySelector<HTMLButtonElement>(".seletor-competencia__atual")!;
    await agir(() => atual.click());
    const dialogo = raiz.querySelector('[role="dialog"]')!;
    expect(atual.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("agosto de 2026");
    expect(dialogo.querySelector<HTMLButtonElement>('[data-competencia="2026-10"]')!.disabled).toBe(true);

    await agir(() => {
      tecla(document.activeElement!, "ArrowLeft");
    });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("julho de 2026");
    // Enter num <button> gera clique no navegador; aqui o clique representa o Enter.
    await agir(() => (document.activeElement as HTMLButtonElement).click());
    expect(mudou).toHaveBeenLastCalledWith("2026-07");
    expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(atual);

    await agir(() => atual.click());
    await agir(() => {
      tecla(document.activeElement!, "Escape");
    });
    expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(atual);
  });

  it("campo digitável do popover aceita 092026", async () => {
    const mudou = vi.fn();
    const raiz = await montar(<Controlado inicial="2026-08" max="2026-12" aoMudar={mudou} />);
    await agir(() => raiz.querySelector<HTMLButtonElement>(".seletor-competencia__atual")!.click());
    const campo = raiz.querySelector<HTMLInputElement>('[role="dialog"] input')!;
    await agir(() => digitar(campo, "092026"));
    expect(campo.value).toBe("09/2026");
    await agir(() => {
      tecla(campo, "Enter");
    });
    expect(mudou).toHaveBeenLastCalledWith("2026-09");
  });
});

describe("<SeletorCompetencia> campo", () => {
  it("aceita vazio, normaliza 9/2026 para 09/2026 ao sair e mostra erro em valor inválido", async () => {
    const mudou = vi.fn();
    const raiz = await montar(<Controlado inicial="" modo="campo" max="2026-12" aoMudar={mudou} />);
    const campo = raiz.querySelector<HTMLInputElement>("input")!;
    expect(campo.value).toBe("");

    await agir(() => digitar(campo, "9/2026"));
    await agir(() => campo.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(mudou).toHaveBeenLastCalledWith("2026-09");
    expect(campo.value).toBe("09/2026");

    await agir(() => digitar(campo, "13/2026"));
    await agir(() => campo.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    const erro = document.getElementById(campo.getAttribute("aria-describedby")!);
    expect(erro?.textContent).toBe("Use MM/AAAA, por exemplo 09/2026");
    expect(mudou).toHaveBeenCalledTimes(1);

    await agir(() => digitar(campo, ""));
    await agir(() => campo.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(campo.getAttribute("aria-invalid")).toBeNull();
    expect(mudou).toHaveBeenLastCalledWith("");
  });

  it("nunca usa <input type=month>", async () => {
    const raiz = await montar(<Controlado inicial="2026-08" modo="campo" />);
    expect(raiz.querySelector('input[type="month"]')).toBeNull();
  });
});
