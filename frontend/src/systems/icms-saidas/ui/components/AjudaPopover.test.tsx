// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { agir, desmontarTudo, montar, tecla } from "../../testes/dom";
import { AJUDA } from "../textosAjuda";
import { AjudaPopover } from "./AjudaPopover";

afterEach(desmontarTudo);

async function montarDuas() {
  const raiz = await montar(
    <p>
      <span>OD</span>
      <AjudaPopover rotulo="OD" texto={AJUDA.od} />
      <AjudaPopover rotulo="ED" texto={AJUDA.ed} />
      <button type="button">fora</button>
    </p>,
  );
  const [od, ed] = [...raiz.querySelectorAll<HTMLButtonElement>(".ajuda__botao")];
  const balao = (botao: HTMLButtonElement) => document.getElementById(botao.getAttribute("aria-controls")!)!;
  return { raiz, od, ed, balao };
}

describe("<AjudaPopover>", () => {
  it("é um botão '?' com rótulo, aria-expanded e aria-controls, fechado por padrão e sem style inline", async () => {
    const { od, balao } = await montarDuas();
    expect(od.textContent).toBe("?");
    expect(od.getAttribute("type")).toBe("button");
    expect(od.getAttribute("aria-label")).toBe("Ajuda: OD");
    expect(od.getAttribute("aria-expanded")).toBe("false");
    expect(balao(od).hidden).toBe(true);
    expect(balao(od).textContent).toContain("Outros Débitos");
    expect(balao(od).getAttribute("style")).toBeNull();
  });

  it("abre e fecha com Enter e Espaço, sem clique duplicado", async () => {
    const { od, balao } = await montarDuas();
    let evento!: KeyboardEvent;
    await agir(() => {
      evento = tecla(od, "Enter");
    });
    expect(evento.defaultPrevented).toBe(true);
    expect(od.getAttribute("aria-expanded")).toBe("true");
    expect(balao(od).hidden).toBe(false);
    await agir(() => {
      tecla(od, " ");
    });
    expect(balao(od).hidden).toBe(true);
  });

  it("Esc fecha e devolve o foco ao botão", async () => {
    const { od, balao } = await montarDuas();
    await agir(() => od.click());
    (document.activeElement as HTMLElement | null)?.blur();
    await agir(() => {
      tecla(document, "Escape");
    });
    expect(balao(od).hidden).toBe(true);
    expect(document.activeElement).toBe(od);
  });

  it("'Fechar' fecha e devolve o foco; clique fora também fecha", async () => {
    const { raiz, od, balao } = await montarDuas();
    await agir(() => od.click());
    await agir(() => balao(od).querySelector("button")!.click());
    expect(balao(od).hidden).toBe(true);
    expect(document.activeElement).toBe(od);

    await agir(() => od.click());
    await agir(() => {
      raiz.querySelector("p > button:last-child")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(balao(od).hidden).toBe(true);
  });

  it("só um popover aberto por vez", async () => {
    const { od, ed, balao } = await montarDuas();
    await agir(() => od.click());
    await agir(() => ed.click());
    expect(balao(ed).hidden).toBe(false);
    expect(balao(od).hidden).toBe(true);
    expect(od.getAttribute("aria-expanded")).toBe("false");
  });

  it("não abre ao passar o mouse", async () => {
    const { od, balao } = await montarDuas();
    await agir(() => {
      od.dispatchEvent(new Event("mouseover", { bubbles: true }));
      od.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    });
    expect(balao(od).hidden).toBe(true);
  });
});
