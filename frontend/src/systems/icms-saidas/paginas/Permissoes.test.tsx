// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { agir, ComSessao, desmontarTudo, montar, respostaJson } from "../testes/dom";
import { Permissoes } from "./Permissoes";

afterEach(() => {
  desmontarTudo();
  vi.unstubAllGlobals();
});

const CATALOGO = [
  { codigo: "icms_saidas.consultar", nome: "Consultar", descricao: "Ver" },
  { codigo: "icms_saidas.operar", nome: "Operar", descricao: "Apurar" },
  { codigo: "icms_saidas.aprovar_lotes", nome: "Aprovar lotes", descricao: "Aprovar" },
];
const USUARIOS = [
  { id: "u1", nome: "Ana Fiscal", email: "ana@mg.com", perfil: "ANALISTA", setor: "FISCAL", admin: false, permissoes: ["icms_saidas.consultar"] },
  { id: "u3", nome: "Carla Nova", email: "carla@mg.com", perfil: "ANALISTA", setor: "FISCAL", admin: false, permissoes: [] },
  { id: "u2", nome: "Beto Admin", email: "beto@mg.com", perfil: "ADMIN", setor: "TI", admin: true, permissoes: [] },
];

function simular() {
  const puts: { url: string; corpo: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const corpo = JSON.parse(String(init.body));
        puts.push({ url, corpo });
        return respostaJson({ id: "u3", permissoes: corpo.permissoes });
      }
      return url.endsWith("/catalogo") ? respostaJson(CATALOGO) : respostaJson(USUARIOS);
    }),
  );
  return puts;
}

async function abrir() {
  const raiz = await montar(
    <ComSessao>
      <Permissoes />
    </ComSessao>,
  );
  await agir(() => {});
  return raiz;
}

/** A linha (li) de uma pessoa pelo nome. */
const pessoa = (raiz: HTMLElement, nome: string) => [...raiz.querySelectorAll("li")].find((li) => li.textContent?.includes(nome))!;
const caixa = (raiz: HTMLElement, nome: string, quem = "Ana Fiscal") =>
  [...pessoa(raiz, quem).querySelectorAll<HTMLInputElement>("input[type=checkbox]")].find((c) => c.closest("label")?.textContent === nome)!;
const salvar = (raiz: HTMLElement, quem = "Ana Fiscal") => [...pessoa(raiz, quem).querySelectorAll("button")].find((b) => b.textContent === "Salvar")!;

describe("Tela de permissões", () => {
  it("lista as pessoas; o ADMIN aparece sem caixas (tem tudo) e quem não é admin com o que já tem marcado", async () => {
    simular();
    const raiz = await abrir();
    expect(raiz.textContent).toContain("Ana Fiscal");
    expect(raiz.textContent).toContain("Beto Admin");
    expect(raiz.textContent).toContain("Administrador: todas as permissões.");
    expect(raiz.querySelectorAll("input[type=checkbox]")).toHaveLength(CATALOGO.length * 2); // Ana e Carla; o admin não tem caixas
    expect(caixa(raiz, "Consultar").checked).toBe(true);
    expect(caixa(raiz, "Operar").checked).toBe(false);
  });

  it("Salvar só habilita com mudança; marcar uma ação marca 'Consultar'; envia o conjunto completo por PUT", async () => {
    const puts = simular();
    const raiz = await abrir();
    expect(salvar(raiz, "Carla Nova").disabled).toBe(true);
    expect(caixa(raiz, "Consultar", "Carla Nova").checked).toBe(false);
    await agir(() => caixa(raiz, "Aprovar lotes", "Carla Nova").click());
    expect(caixa(raiz, "Consultar", "Carla Nova").checked).toBe(true);
    expect(salvar(raiz, "Carla Nova").disabled).toBe(false);
    await agir(() => salvar(raiz, "Carla Nova").click());
    expect(puts).toEqual([{ url: "/api/v1/icms-saidas/permissoes/usuarios/u3", corpo: { permissoes: ["icms_saidas.aprovar_lotes", "icms_saidas.consultar"] } }]);
    expect(pessoa(raiz, "Carla Nova").textContent).toContain("Salvo.");
    expect(salvar(raiz, "Carla Nova").disabled).toBe(true);
  });

  it("desmarcar 'Consultar' tira todas as outras (ação sem consulta não existe)", async () => {
    simular();
    const raiz = await abrir();
    await agir(() => caixa(raiz, "Operar").click());
    expect(caixa(raiz, "Operar").checked).toBe(true);
    await agir(() => caixa(raiz, "Consultar").click());
    expect(caixa(raiz, "Consultar").checked).toBe(false);
    expect(caixa(raiz, "Operar").checked).toBe(false);
  });

  it("a busca filtra por nome ou e-mail", async () => {
    simular();
    const raiz = await abrir();
    const campo = raiz.querySelector<HTMLInputElement>("input[type=search], input:not([type=checkbox])")!;
    await agir(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(campo, "beto@");
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(raiz.textContent).toContain("Beto Admin");
    expect(raiz.textContent).not.toContain("Ana Fiscal");
  });
});
