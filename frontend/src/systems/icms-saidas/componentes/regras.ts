// Regras fiscais globais do motor (ADR-007): o painel só lê as categorias aceitas na coluna ICMS da memória.
import { consulta } from "../api";
import type { Regras } from "../tipos";
import { useCarregar } from "./comuns";

export type Categoria = { nome: string; grupo: string };

/** Regras atuais (sem competência) ou as vigentes na competência AAAA-MM. */
export function useRegras(competencia?: string) {
  return useCarregar<Regras>(`/api/regras${consulta({ competencia })}`);
}

/** Categorias (nome canônico + grupo de cálculo), em ordem alfabética. */
export function categoriasDasRegras(regras: Regras | null | undefined): Categoria[] {
  const lista = regras?.conteudo.categorias ?? [];
  return lista
    .filter((c) => typeof c?.nome === "string" && c.nome)
    .map((c) => ({ nome: c.nome, grupo: typeof c.grupo === "string" ? c.grupo : "" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Apelidos aceitos na memória (grafia alternativa → categoria canônica). */
export function apelidosDasRegras(regras: Regras | null | undefined): { texto: string; categoria: string }[] {
  return (regras?.conteudo.aliases ?? []).filter((a) => typeof a?.texto === "string" && typeof a?.categoria === "string");
}
