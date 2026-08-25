import { useMemo } from "react";
import { Link } from "react-router-dom";
import { calcularPrazo, competenciaCurta } from "../../lib/prazo";
import type { DashboardEmpresaAberta } from "../../hooks/queries";
import { BlocoEstado } from "./BlocoEstado";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";

/** Empresas cuja apuração ainda não fechou, ordenadas por urgência de prazo
 * (vencidas primeiro). Inclui competências anteriores em aberto, não só a
 * selecionada — competência antiga vencida é o caso mais urgente. */
export function EmpresasAbertas({
  itens,
  carregando,
  erro,
  onTentarNovamente,
}: {
  itens: DashboardEmpresaAberta[];
  carregando: boolean;
  erro: boolean;
  onTentarNovamente: () => void;
}) {
  const toAbs = useNativeSystemPath();
  const ordenadas = useMemo(
    () =>
      itens
        .map((e) => ({ ...e, prazo: calcularPrazo(competenciaCurta(e.competencia)) }))
        .sort((a, b) => b.prazo.peso - a.prazo.peso || a.prazo.dias - b.prazo.dias),
    [itens],
  );

  return (
    <div className="dash-card dash-col">
      <div className="dash-card-head">
        <div className="dash-card-head-left">
          <h2 className="dash-card-titulo">Empresas sem apuração fechada</h2>
          {!carregando && !erro && <span className="num dash-badge-contagem dash-badge-erro">{ordenadas.length}</span>}
        </div>
        <span className="dash-card-head-hint">Ordenado por prazo</span>
      </div>

      <div className="dash-lista-scroll dash-lista-abertas">
        <BlocoEstado
          carregando={carregando}
          erro={erro}
          vazio={ordenadas.length === 0}
          mensagemVazio="Todas as apurações do seu escopo estão fechadas."
          titulo="Não foi possível carregar as empresas em aberto"
          onTentarNovamente={onTentarNovamente}
          linhasSkeleton={4}
        >
          {ordenadas.map((e) => (
            <Link key={`${e.company_id}-${e.competencia}`} to={toAbs(e.link.replace(/^\//, ""))} className="dash-linha dash-linha-aberta">
              <span className="dash-trunc dash-linha-nome">{e.nome}</span>
              <span className="dash-trunc dash-linha-motivo">{e.motivo}</span>
              <span className="num dash-linha-comp">{competenciaCurta(e.competencia)}</span>
              <span className="dash-linha-prazo">
                <span className="num dash-linha-prazo-data">{e.prazo.dataCurta}</span>
                <span
                  className="dash-pill"
                  style={{ borderColor: `${e.prazo.cor}33`, background: `${e.prazo.cor}1a`, color: e.prazo.cor }}
                >
                  {e.prazo.label}
                </span>
              </span>
            </Link>
          ))}
        </BlocoEstado>
      </div>
    </div>
  );
}
