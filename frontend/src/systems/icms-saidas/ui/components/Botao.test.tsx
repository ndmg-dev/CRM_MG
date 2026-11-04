// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { agir, desmontarTudo, enviarFormulario, montar } from "../../testes/dom";
import { Botao } from "./Botao";

afterEach(desmontarTudo);

describe("<Botao>", () => {
  it("carregando: disabled + aria-busy, não clica", async () => {
    const clique = vi.fn();
    const raiz = await montar(
      <Botao variante="primario" carregando onClick={clique}>
        Processando…
      </Botao>,
    );
    const botao = raiz.querySelector("button")!;
    expect(botao.disabled).toBe(true);
    expect(botao.getAttribute("aria-busy")).toBe("true");
    await agir(() => botao.click());
    expect(clique).not.toHaveBeenCalled();
  });

  it("indisponível por regra: aria-disabled, continua focável, motivo ligado por aria-describedby e clique bloqueado", async () => {
    const clique = vi.fn();
    const raiz = await montar(
      <Botao variante="primario" desabilitadoMotivo="Selecione ao menos um item" onClick={clique}>
        Aplicar selecionados (0)
      </Botao>,
    );
    const botao = raiz.querySelector("button")!;
    expect(botao.disabled).toBe(false);
    expect(botao.getAttribute("aria-disabled")).toBe("true");
    botao.focus();
    expect(document.activeElement).toBe(botao);
    const motivo = document.getElementById(botao.getAttribute("aria-describedby")!);
    expect(motivo?.textContent).toBe("Selecione ao menos um item");
    await agir(() => botao.click());
    expect(clique).not.toHaveBeenCalled();
  });

  it("indisponível dentro de formulário: Enter/clique não enviam", async () => {
    const envio = vi.fn((e: Event) => e.preventDefault());
    const raiz = await montar(
      <form onSubmit={(e) => envio(e.nativeEvent)}>
        <Botao type="submit" desabilitadoMotivo="Lote bloqueado">
          Aplicar
        </Botao>
      </form>,
    );
    await agir(() => raiz.querySelector("button")!.click());
    expect(envio).not.toHaveBeenCalled();
    // o envio direto do formulário (fora do botão) não é responsabilidade do botão
    await agir(() => enviarFormulario(raiz.querySelector("form")!));
    expect(envio).toHaveBeenCalledTimes(1);
  });

  it("sem style inline e com classes de variante e tamanho", async () => {
    const raiz = await montar(
      <Botao variante="perigo" tamanho="compacto">
        Rejeitar lote
      </Botao>,
    );
    const botao = raiz.querySelector("button")!;
    expect(botao.getAttribute("style")).toBeNull();
    expect(botao.className).toBe("botao botao--perigo botao--compacto");
    expect(botao.getAttribute("type")).toBe("button");
  });
});
