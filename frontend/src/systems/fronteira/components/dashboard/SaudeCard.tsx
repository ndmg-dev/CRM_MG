import type { DashboardSaude } from "../../hooks/queries";
import { BlocoEstado } from "./BlocoEstado";

const COR_NIVEL: Record<string, string> = {
  ok: "#22c55e",
  atencao: "#f59e0b",
  erro: "#ef4444",
};

/** Auditoria da base de regras: importante, não urgente — por isso é uma lista
 * compacta e não um KPI grande disputando o topo da tela. */
export function SaudeCard({
  saude,
  carregando,
  erro,
  onTentarNovamente,
}: {
  saude: DashboardSaude | undefined;
  carregando: boolean;
  erro: boolean;
  onTentarNovamente: () => void;
}) {
  return (
    <div className="dash-card dash-saude">
      <h2 className="dash-card-titulo dash-saude-titulo">Saúde da base de regras</h2>
      <BlocoEstado
        carregando={carregando}
        erro={erro}
        titulo="Não foi possível carregar a saúde da base"
        onTentarNovamente={onTentarNovamente}
        linhasSkeleton={4}
      >
        {(saude?.linhas ?? []).map((linha) => {
          const cor = COR_NIVEL[linha.nivel] ?? "#22c55e";
          return (
            <div key={linha.label} className="dash-saude-linha">
              <span className="dash-saude-label">{linha.label}</span>
              <span className="dash-saude-direita">
                <span className="num dash-saude-valor">{linha.valor}</span>
                <span
                  className="dash-pill"
                  style={{ borderColor: `${cor}33`, background: `${cor}1a`, color: cor }}
                >
                  {linha.nota}
                </span>
              </span>
            </div>
          );
        })}
      </BlocoEstado>
    </div>
  );
}
