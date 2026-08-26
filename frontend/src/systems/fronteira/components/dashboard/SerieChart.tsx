import type { DashboardSerie, DashboardSeries } from "../../hooks/queries";
import { BlocoEstado } from "./BlocoEstado";

const ABAS: { id: keyof DashboardSeries; label: string }[] = [
  { id: "volume", label: "Volume" },
  { id: "sefaz", label: "SEFAZ" },
  { id: "imposto", label: "Imposto" },
];

function rotuloMes(competencia: string): string {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mes = Number(competencia.split("-")[1]);
  return meses[mes - 1] ?? competencia;
}

/** Três leituras num slot só, em vez de três gráficos disputando atenção.
 * A última barra é a competência corrente — desenhada com opacidade reduzida
 * porque está PARCIAL: sem isso, o mês em andamento é lido como queda. */
export function SerieChart({
  series,
  aba,
  onAba,
  carregando,
  erro,
  onTentarNovamente,
}: {
  series: DashboardSeries | undefined;
  aba: keyof DashboardSeries;
  onAba: (a: keyof DashboardSeries) => void;
  carregando: boolean;
  erro: boolean;
  onTentarNovamente: () => void;
}) {
  const serie: DashboardSerie | undefined = series?.[aba];
  const barras = serie?.barras ?? [];
  const totais = barras.map((b) => b.valores.reduce((s, v) => s + Number(v), 0));
  const max = Math.max(...totais, 0);

  return (
    <div className="dash-card dash-chart">
      <div className="dash-chart-head">
        <h2 className="dash-card-titulo">{serie?.titulo ?? "Tendência"}</h2>
        <div className="dash-abas">
          {ABAS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`dash-aba ${aba === t.id ? "ativa" : ""}`}
              onClick={() => onAba(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="dash-chart-unidade">{serie?.unidade ?? ""}</div>

      <BlocoEstado
        carregando={carregando}
        erro={erro}
        vazio={!serie || max === 0}
        mensagemVazio="Sem movimento nas últimas competências."
        titulo="Não foi possível carregar a tendência"
        onTentarNovamente={onTentarNovamente}
        linhasSkeleton={3}
      >
        <>
          <div className="dash-chart-barras">
            {barras.map((b, i) => {
              const parcial = i === barras.length - 1;
              return (
                <div key={b.competencia} className="dash-chart-coluna">
                  {b.valores.map((v, j) => {
                    const altura = max > 0 ? (Number(v) / max) * 100 : 0;
                    if (altura <= 0) return null;
                    return (
                      <div
                        key={j}
                        className="dash-chart-segmento"
                        style={{
                          height: `${altura}%`,
                          background: serie!.cores[j] ?? "#3b82f6",
                          opacity: parcial ? 0.45 : 1,
                          borderRadius: j === 0 ? "2px 2px 0 0" : undefined,
                        }}
                        title={`${serie!.legenda[j]}: ${Number(v).toLocaleString("pt-BR")}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="dash-chart-rotulos">
            {barras.map((b, i) => (
              <div
                key={b.competencia}
                className={`num dash-chart-rotulo ${i === barras.length - 1 ? "parcial" : ""}`}
              >
                {rotuloMes(b.competencia)}
              </div>
            ))}
          </div>

          <div className="dash-chart-legenda">
            {(serie?.legenda ?? []).map((label, i) => (
              <span key={label} className="dash-chart-legenda-item">
                <span className="dash-chart-legenda-cor" style={{ background: serie!.cores[i] }} />
                {label}
              </span>
            ))}
          </div>
        </>
      </BlocoEstado>
    </div>
  );
}
