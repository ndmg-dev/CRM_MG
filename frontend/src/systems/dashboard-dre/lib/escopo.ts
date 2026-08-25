/**
 * Vocabulário de escopo e de telas, sem dependência de React.
 *
 * Vive fora de `store.ts` porque o store é um módulo `"use client"` (zustand) e
 * este vocabulário também é usado no servidor, pelas ferramentas do assistente.
 * Importar o store numa Route Handler arrastaria um módulo de cliente para
 * dentro da função. `store.ts` reexporta tudo daqui, então nada muda para os
 * componentes.
 */

import type { Escopo } from "./types";

export type Tela =
  | "visao-geral"
  | "comparativo"
  | "composicao"
  | "drilldown"
  | "insights";

/**
 * O mínimo que estas funções precisam saber do dataset.
 *
 * Tipo estrutural em vez de `Indice` para manter o módulo sem dependência de
 * `metrics.ts` — qualquer objeto com as duas listas serve, inclusive em teste.
 */
export interface Unidades {
  varejo: string[];
  atacado: string[];
}

/** Nome humano do segmento de uma unidade. */
export function nomeDoSegmento(unidades: Unidades, codigo: string): string {
  return unidades.atacado.includes(codigo) ? "Atacado" : "Varejo";
}

/**
 * Rótulo de exibição do escopo.
 *
 * 🔴 As unidades são IRMÃS: nenhuma contém outra. O rótulo não deve sugerir
 * hierarquia — foi assim que "JNS VAR" passou anos sendo lido como consolidado.
 * Por isso uma unidade aparece pelo código da aba, que casa 1:1 com a planilha,
 * e só os escopos sintéticos ganham nome próprio.
 */
export function rotuloEscopo(escopo: Escopo, unidades: Unidades): string {
  if (escopo.tipo === "grupo_total") return "Grupo total";
  if (escopo.tipo === "soma_lojas") return "Varejo";
  if (unidades.atacado.includes(escopo.codigo))
    return `Atacado (${escopo.codigo})`;
  return escopo.codigo;
}
