"use client";

/** Estado dos filtros globais (spec §7.1) — persistem entre telas. */

import { create } from "zustand";
import type { Escopo } from "./types";
import type { Tela } from "./escopo";

// Reexportados de `escopo.ts` (módulo neutro, sem React) para não quebrar os
// imports existentes — o servidor consome de lá, os componentes daqui.
export { nomeDoSegmento, rotuloEscopo } from "./escopo";
export type { Tela, Unidades } from "./escopo";

export type ModoComparacao = "mes_a_mes" | "vs_media";

interface EstadoFiltros {
  tela: Tela;
  setTela: (tela: Tela) => void;
  escopo: Escopo;
  /** meses selecionados (1–6), sempre ordenados */
  meses: number[];
  comparacao: ModoComparacao;
  setEscopo: (escopo: Escopo) => void;
  setMeses: (meses: number[]) => void;
  alternarMes: (mes: number) => void;
  setComparacao: (modo: ModoComparacao) => void;
}

const TODOS_OS_MESES = [1, 2, 3, 4, 5, 6];

export const useFiltros = create<EstadoFiltros>((set) => ({
  tela: "visao-geral",
  setTela: (tela) => set({ tela }),
  // Padrão: o grupo inteiro (varejo + atacado). Escopo sintético, não depende
  // de nenhum código de aba — que o contador renomeia.
  escopo: { tipo: "grupo_total" },
  meses: TODOS_OS_MESES,
  comparacao: "mes_a_mes",
  setEscopo: (escopo) => set({ escopo }),
  setMeses: (meses) => set({ meses: [...meses].sort((a, b) => a - b) }),
  alternarMes: (mes) =>
    set((estado) => {
      const proximos = estado.meses.includes(mes)
        ? estado.meses.filter((m) => m !== mes)
        : [...estado.meses, mes];
      // nunca deixar a seleção vazia
      return {
        meses: (proximos.length ? proximos : [mes]).sort((a, b) => a - b),
      };
    }),
  setComparacao: (comparacao) => set({ comparacao }),
}));
