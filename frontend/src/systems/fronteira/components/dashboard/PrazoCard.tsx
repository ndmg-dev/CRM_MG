import { calcularPrazo, labelContagem } from "../../lib/prazo";

/** Contagem regressiva do recolhimento + progresso de apuração do escopo.
 * A borda do card assume a cor da urgência (`{cor}44`). */
export function PrazoCard({
  competencia,
  apuradas,
  totalEscopo,
  vencidas,
  carregando,
}: {
  competencia: string;
  apuradas: number;
  totalEscopo: number;
  vencidas: number;
  carregando: boolean;
}) {
  const prazo = calcularPrazo(competencia);
  const pct = totalEscopo > 0 ? Math.round((apuradas / totalEscopo) * 100) : 0;

  return (
    <div className="dash-card dash-prazo" style={{ borderColor: `${prazo.cor}44` }}>
      <div>
        <div className="dash-label">ICMS Fronteira · {competencia}</div>
        <div className="dash-prazo-num-row">
          <span className="num dash-prazo-num" style={{ color: prazo.cor }}>
            {carregando ? "—" : prazo.numero}
          </span>
          <span className="dash-prazo-label">{labelContagem(prazo)}</span>
        </div>
        <div className="dash-prazo-data">
          Recolhimento até <span className="num dash-prazo-data-valor">{prazo.dataCurta}</span>
        </div>
      </div>

      <div>
        <div className="dash-prazo-progresso-head">
          <span>Apuradas no seu escopo</span>
          <span className="num dash-prazo-progresso-valor">
            {carregando ? "—" : `${apuradas}/${totalEscopo}`}
          </span>
        </div>
        <div className="dash-progresso-trilho">
          <div className="dash-progresso-fill" style={{ width: `${carregando ? 0 : pct}%` }} />
        </div>
        <div className="dash-prazo-vencidas">
          <span className="num dash-prazo-vencidas-num">{carregando ? "—" : vencidas}</span> competências já vencidas sem apuração
        </div>
      </div>
    </div>
  );
}
