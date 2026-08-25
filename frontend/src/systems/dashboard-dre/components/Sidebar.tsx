"use client";

import { IconePainel } from "./icons";
import { useFiltros, type Tela } from "../lib/store";

/**
 * Portado de ndmg-dev/DASH_RAZAO sem alteração de estrutura — a barra
 * lateral fixa é a spec (SPECS/design-system.md §4: "barra lateral fixa
 * com marca no topo + navegação"), mantida de propósito mesmo o CRM já
 * tendo sua própria sidebar fina de ícones (são visualmente distintas o
 * bastante pra não se confundirem, e a spec pede explicitamente esse shell).
 *
 * Única mudança: o bloco de marca "Mendonça Galvão / Contadores Associados"
 * foi removido — o CRM já mostra isso no próprio Header, repetir aqui é
 * redundante. A navegação continua igual ao original.
 *
 * Fase 1 (nativo): só "Visão geral" está portada. As demais telas
 * (Comparativo, Composição, Drilldown, Insights) entram em fases seguintes —
 * ver EXPLICACOES em lib/telas.ts, que já tem o texto delas pronto.
 */
const NAV: {
  id: Tela;
  rotulo: string;
  resumo: string;
  Icone: (props: { tamanho?: number }) => React.ReactElement;
}[] = [
  {
    id: "visao-geral",
    rotulo: "Visão geral",
    resumo: "como estamos",
    Icone: IconePainel,
  },
];

export function Sidebar() {
  const { tela, setTela } = useFiltros();

  return (
    <aside className="w-full shrink-0 border-b border-line bg-sidebar lg:h-screen lg:w-60 lg:border-r lg:border-b-0">
      <div className="flex h-full flex-col lg:sticky lg:top-0">
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => {
            const ativo = tela === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTela(item.id)}
                aria-current={ativo ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[14px] whitespace-nowrap transition-colors ${
                  ativo
                    ? "bg-gold-tint text-gold"
                    : "text-text-muted hover:bg-panel-2 hover:text-text"
                }`}
              >
                <span className="shrink-0">
                  <item.Icone tamanho={16} />
                </span>
                <span className="flex flex-col leading-tight">
                  {item.rotulo}
                  <span
                    className={`hidden text-[11px] lg:block ${
                      ativo ? "text-gold-soft" : "text-text-faint"
                    }`}
                  >
                    {item.resumo}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
