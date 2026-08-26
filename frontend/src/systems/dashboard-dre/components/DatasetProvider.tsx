"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { indexar, type Indice } from "../lib/metrics";
import { useFiltros } from "../lib/store";
import type { Dataset } from "../lib/types";
import { dreFetch } from "../lib/api";

const IndiceContext = createContext<Indice | null>(null);

export function useIndice(): Indice {
  const indice = useContext(IndiceContext);
  if (!indice) throw new Error("useIndice fora do DatasetProvider");
  return indice;
}

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    dreFetch("/data/dataset.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Dataset>;
      })
      .then((d) => ativo && setDataset(d))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, []);

  const indice = useMemo(() => (dataset ? indexar(dataset) : null), [dataset]);

  // Autocorreção: escopo apontando para uma aba que não existe mais (aconteceu
  // quando o contador renomeou as abas) volta para o grupo total, que é
  // sintético e por isso sempre válido.
  // useLayoutEffect: ajusta antes da pintura, sem piscar o escopo errado.
  useLayoutEffect(() => {
    if (!indice) return;
    const { escopo, setEscopo } = useFiltros.getState();
    if (escopo.tipo !== "empresa") return;
    const existe = indice.dataset.dim_empresa.some(
      (e) => e.codigo === escopo.codigo && e.tem_dados,
    );
    if (!existe) setEscopo({ tipo: "grupo_total" });
  }, [indice]);

  if (erro) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md rounded-[10px] border border-line bg-panel p-6">
          <p className="text-sm font-medium text-neg">
            Não foi possível carregar o dataset
          </p>
          <p className="mt-2 text-[13px] text-text-muted">
            {erro}.
          </p>
        </div>
      </div>
    );
  }

  if (!indice) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13px] tracking-[.08em] text-text-faint uppercase">
          Carregando DRE…
        </p>
      </div>
    );
  }

  return (
    <IndiceContext.Provider value={indice}>{children}</IndiceContext.Provider>
  );
}
