"use client";

import { useIndice } from "./DatasetProvider";
import { nomeMes } from "../lib/metrics";
import { rotuloEscopo, useFiltros } from "../lib/store";

/**
 * Frase que confirma, em português corrente, o que os números abaixo são
 * (spec §5.3 — exigência de UI para evitar leitura errada).
 *
 * 🔴 As unidades são irmãs, nenhuma contém outra — o nome das abas sugere o
 * contrário. Dizer em palavras o que está na tela é o que evita alguém ler
 * "JNS VAR" como se fosse o grupo inteiro.
 *
 * A composição em números fica nos chips de `Filtros`; aqui é só a leitura em
 * palavras, para quem chegou na tela sem olhar o filtro.
 */
export function EscopoInfo() {
  const indice = useIndice();
  const { escopo, meses } = useFiltros();

  /** "jan a jun" quando os meses são seguidos; a lista, quando não são. */
  const periodo = (() => {
    const seguidos = meses.every((m, i) => i === 0 || m === meses[i - 1] + 1);
    if (meses.length === 1) return nomeMes(meses[0]);
    return seguidos
      ? `${nomeMes(meses[0])} a ${nomeMes(meses[meses.length - 1])}`
      : meses.map(nomeMes).join(", ");
  })();

  /** O que o escopo ativo é, em palavras. */
  const explicacao = (): string => {
    if (escopo.tipo === "grupo_total")
      return `as ${indice.unidades.length} unidades somadas — varejo e atacado`;
    if (escopo.tipo === "soma_lojas")
      return `as unidades de varejo somadas (${indice.varejo.join(", ")})`;
    if (indice.atacado.includes(escopo.codigo))
      return "o atacado — vende só por convênio, não é comparável com o varejo";
    return "uma unidade de varejo, isolada das demais";
  };

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <h1 className="text-[13px] font-medium text-text">
        Você está vendo{" "}
        <span className="text-gold">{rotuloEscopo(escopo, indice)}</span>, de{" "}
        {periodo} de {indice.dataset.meta.ano}
      </h1>
      <span className="text-[11px] text-text-faint">— {explicacao()}</span>
    </div>
  );
}
