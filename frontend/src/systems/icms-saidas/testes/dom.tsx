// Utilitários dos testes de componente (ambiente jsdom, sem biblioteca extra): montar, agir e esperar o React.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { Contexto, PERMISSOES, type ContextoPermissoes } from "../auth/permissoes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let raizes: { raiz: Root; recipiente: HTMLElement }[] = [];

export async function montar(elemento: ReactNode): Promise<HTMLElement> {
  const recipiente = document.createElement("div");
  document.body.appendChild(recipiente);
  const raiz = createRoot(recipiente);
  raizes.push({ raiz, recipiente });
  await act(async () => raiz.render(elemento));
  return recipiente;
}

export function desmontarTudo(): void {
  for (const { raiz, recipiente } of raizes) {
    act(() => raiz.unmount());
    recipiente.remove();
  }
  raizes = [];
}

/** Executa a ação dentro de act() e deixa as promessas (fetch simulado) terminarem. */
export async function agir(acao: () => void): Promise<void> {
  await act(async () => {
    acao();
    await new Promise((resolver) => setTimeout(resolver, 0));
  });
}

export function tecla(alvo: EventTarget, key: string): KeyboardEvent {
  const evento = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  alvo.dispatchEvent(evento);
  return evento;
}

/** Simula a escolha de arquivo num <input type="file"> controlado pelo React. */
export function escolherArquivo(campo: HTMLInputElement, arquivo: File): void {
  let valor = `C:\\fakepath\\${arquivo.name}`;
  Object.defineProperty(campo, "files", { configurable: true, value: [arquivo] });
  Object.defineProperty(campo, "value", {
    configurable: true,
    get: () => valor,
    set: (novo: string) => {
      valor = novo; // o componente limpa o campo depois de enviar
    },
  });
  campo.dispatchEvent(new Event("change", { bubbles: true }));
}

export function enviarFormulario(formulario: HTMLFormElement): void {
  formulario.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

export function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

/** Permissões fixas (sem GET /eu) e roteador em memória montado como no CRM (`/sistemas/:id/*`), para testar páginas. */
export const PAPEIS_DE_TESTE = {
  /** Tudo liberado (ADMIN do CRM). */
  admin: Object.values(PERMISSOES) as string[],
  /** Operador comum: consulta e opera, mas não aprova nem gerencia. */
  analista: [PERMISSOES.consultar, PERMISSOES.operar] as string[],
  /** Só leitura. */
  consulta: [PERMISSOES.consultar] as string[],
} as const;

export function ComSessao({
  papel = "admin",
  permissoes,
  url = "/",
  children,
}: {
  papel?: keyof typeof PAPEIS_DE_TESTE;
  permissoes?: string[];
  url?: string;
  children: ReactNode;
}) {
  const concedidas = new Set(permissoes ?? PAPEIS_DE_TESTE[papel]);
  const valor: ContextoPermissoes = { nome: "Tiago", admin: papel === "admin", carregando: false, pode: (p) => concedidas.has(p) };
  return (
    <MemoryRouter initialEntries={[`/sistemas/teste${url === "/" ? "" : url}`]}>
      <Contexto.Provider value={valor}>
        <Routes>
          <Route path="/sistemas/:id/*" element={children} />
        </Routes>
      </Contexto.Provider>
    </MemoryRouter>
  );
}
