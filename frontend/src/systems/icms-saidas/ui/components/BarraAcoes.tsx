import type { ReactNode } from "react";

import "./barra-acoes.css";

/** Barra fixa no rodapé (sticky) com o resumo da seleção em `role="status"` e as ações à direita. */
export function BarraAcoes({ resumo, acoes, rotulo = "Ações" }: { resumo: ReactNode; acoes?: ReactNode; rotulo?: string }) {
  return (
    <div className="barra-acoes" role="region" aria-label={rotulo}>
      <div className="barra-acoes__resumo" role="status">
        {resumo}
      </div>
      {acoes && <div className="barra-acoes__acoes">{acoes}</div>}
    </div>
  );
}
