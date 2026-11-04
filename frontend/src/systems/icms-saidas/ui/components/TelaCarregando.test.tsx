// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { desmontarTudo, montar } from "../../testes/dom";
import { iniciarCarregamento, lerEntradas } from "../carregando";
import { ATRASO_MS, MINIMO_MS, TelaCarregando } from "./TelaCarregando";

beforeAll(() => {
  // jsdom não implementa showModal/close do <dialog>.
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  desmontarTudo();
  vi.useRealTimers();
  expect(lerEntradas()).toHaveLength(0); // nenhum teste deixa a tela travada para o seguinte
});

const avancar = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));
/** Liga/desliga DENTRO do act, como o React espera: senão a mudança só é processada depois de o tempo já ter passado. */
function ligar(texto: string): () => void {
  let fim: () => void = () => {};
  act(() => {
    fim = iniciarCarregamento(texto);
  });
  return () => act(() => fim());
}
const aberto = (raiz: HTMLElement) => raiz.querySelector("dialog")!.hasAttribute("open");

describe("Tela de carregamento", () => {
  it("começa fechada, aparece depois do atraso com o texto da operação e some quando termina", async () => {
    const raiz = await montar(<TelaCarregando />);
    expect(aberto(raiz)).toBe(false);
    const fim = ligar("Lendo o arquivo do lote… pode levar alguns segundos.");
    await avancar(ATRASO_MS - 1);
    expect(aberto(raiz)).toBe(false); // ainda não: operações rápidas não piscam a tela
    await avancar(1);
    expect(aberto(raiz)).toBe(true);
    const caixa = raiz.querySelector('[role="status"]')!;
    expect(caixa.textContent).toBe("Lendo o arquivo do lote… pode levar alguns segundos.");
    expect(raiz.querySelector(".carregando__giro")).not.toBeNull();
    fim();
    await avancar(MINIMO_MS);
    expect(aberto(raiz)).toBe(false);
  });

  it("operação mais rápida que o atraso nunca mostra a tela", async () => {
    const raiz = await montar(<TelaCarregando />);
    const fim = ligar("rápida");
    await avancar(ATRASO_MS - 50);
    fim();
    await avancar(2000);
    expect(aberto(raiz)).toBe(false);
  });

  it("depois de aparecer, fica o tempo mínimo (não pisca se a resposta chega logo)", async () => {
    const raiz = await montar(<TelaCarregando />);
    const fim = ligar("x");
    await avancar(ATRASO_MS);
    expect(aberto(raiz)).toBe(true);
    await avancar(50);
    fim();
    await avancar(MINIMO_MS - 100);
    expect(aberto(raiz)).toBe(true); // ainda dentro do mínimo
    await avancar(100);
    expect(aberto(raiz)).toBe(false);
  });

  it("várias requisições juntas: uma tela só, com o texto da mais recente, e só some quando TODAS terminam", async () => {
    const raiz = await montar(<TelaCarregando />);
    const a = ligar("Carregando o lote…");
    const b = ligar("Carregando as diferenças do lote…");
    await avancar(ATRASO_MS);
    expect(raiz.querySelectorAll("dialog")).toHaveLength(1);
    expect(raiz.querySelector('[role="status"]')!.textContent).toBe("Carregando as diferenças do lote…");
    b();
    await avancar(MINIMO_MS);
    expect(aberto(raiz)).toBe(true); // a primeira ainda está em andamento
    expect(raiz.querySelector('[role="status"]')!.textContent).toBe("Carregando o lote…"); // passa a descrever a que ainda está pendente
    a();
    await avancar(MINIMO_MS);
    expect(aberto(raiz)).toBe(false);
  });

  it("Esc não fecha: a tela só some quando o carregamento termina", async () => {
    const raiz = await montar(<TelaCarregando />);
    const fim = ligar("x");
    await avancar(ATRASO_MS);
    const esc = new Event("cancel", { cancelable: true });
    raiz.querySelector("dialog")!.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(aberto(raiz)).toBe(true);
    fim();
    await avancar(MINIMO_MS);
  });

  it("é um diálogo modal acessível: nome, região de status e sem estilo inline", async () => {
    const raiz = await montar(<TelaCarregando />);
    const dialogo = raiz.querySelector("dialog")!;
    expect(dialogo.getAttribute("aria-label")).toBe("Carregando");
    expect(raiz.querySelector('[role="status"]')!.getAttribute("aria-live")).toBe("polite");
    expect(raiz.querySelector(".carregando__giro")!.getAttribute("aria-hidden")).toBe("true");
    expect(raiz.innerHTML).not.toContain("style=");
  });
});
