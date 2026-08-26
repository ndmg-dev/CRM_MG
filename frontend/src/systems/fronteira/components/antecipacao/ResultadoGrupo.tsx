import { useEffect, useRef, useState } from "react";
import { Badge, Button, Spinner } from "@fronteira-ui";
import {
  TRIBUTACAO_ANTECIPACAO_LABEL,
  useAntecipacaoCompetencia,
  useCalcularAntecipacao,
  useExportAntecipacao,
} from "../../hooks/queries";
import { apiError } from "../../lib/api";
import { useLoader } from "../LoaderOverlay";
import { formatMoney } from "../../lib/format";

function competenciaLabel(competencia: string): string {
  return `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;
}

/** Passo Resultado (por apuração): garante o cálculo (dispara automaticamente
 * se já está pronto pra calcular, como o Fronteira), mostra as notas/itens
 * calculados e permite exportar o XLSX individual. */
export function ResultadoGrupo({
  companyId,
  competencia,
  nomeEmpresa,
}: {
  companyId: number;
  competencia: string;
  nomeEmpresa?: string;
}) {
  const { data: comp } = useAntecipacaoCompetencia(companyId, competencia);
  const calcular = useCalcularAntecipacao(companyId, competencia);
  const exportar = useExportAntecipacao();
  const loader = useLoader();
  const [error, setError] = useState("");
  const calcRef = useRef(false);

  // auto-calcula uma vez quando a apuração está pronta (todos classificados,
  // ainda não calculada) — mesmo comportamento do Resultado do Fronteira.
  useEffect(() => {
    if (calcRef.current) return;
    if (comp?.situacao === "pronto_para_calcular") {
      calcRef.current = true;
      loader.show("Calculando antecipação interna…");
      calcular
        .mutateAsync()
        .catch((err) => setError(apiError(err, "Não foi possível calcular.")))
        .finally(() => loader.hide());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp?.situacao]);

  async function handleExport() {
    setError("");
    try {
      await exportar.mutateAsync({ companyId, competencia });
    } catch (err) {
      setError(apiError(err, "Não foi possível exportar o XLSX."));
    }
  }

  async function handleCalcular() {
    setError("");
    try {
      await loader.run("Calculando antecipação interna…", () => calcular.mutateAsync());
    } catch (err) {
      setError(apiError(err, "Não foi possível calcular."));
    }
  }

  if (!comp) return <div className="card"><div className="card-body empty">Carregando…</div></div>;

  const calculando = calcular.isPending;
  const classificacaoPendente = comp.situacao === "aguardando_classificacao";

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2 style={{ fontSize: 14 }}>
            {nomeEmpresa ? `${nomeEmpresa} · ` : ""}
            {competenciaLabel(competencia)}
          </h2>
          <span className="page-sub">
            {comp.total_notas} nota(s) · {comp.total_itens} item(ns) · <strong>{formatMoney(comp.total_imposto)}</strong>
          </span>
        </div>
        <div className="row gap-8">
          {comp.situacao === "calculado" && (
            <Button variant="primary" size="sm" disabled={exportar.isPending} loading={exportar.isPending} onClick={handleExport}>
              {exportar.isPending ? "Exportando…" : "↓ Exportar XLSX"}
            </Button>
          )}
          <Badge variant={comp.situacao === "calculado" ? "ok" : classificacaoPendente ? "warn" : "neutral"}>
            <span className="row gap-8" style={{ alignItems: "center" }}>
              {calculando && <Spinner size="sm" />}
              {comp.situacao === "calculado"
                ? "Calculado"
                : classificacaoPendente
                  ? "Classificação pendente"
                  : calculando
                    ? "Calculando…"
                    : "Pronto para calcular"}
            </span>
          </Badge>
        </div>
      </div>

      <div className="card-body stack gap-24">
        {error && <div className="alert alert-danger">{error}</div>}
        {classificacaoPendente && (
          <div className="alert alert-warn">
            Ainda há itens pendentes. Volte à Classificação para concluí-los antes de calcular.
          </div>
        )}
        {!classificacaoPendente && comp.situacao === "pronto_para_calcular" && !calculando && (
          <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted">O cálculo automático não está em andamento.</span>
            <Button variant="primary" size="sm" onClick={handleCalcular}>
              {error ? "Tentar calcular novamente" : "Calcular"}
            </Button>
          </div>
        )}
        {calculando && comp.situacao !== "calculado" && <div className="empty">Calculando o imposto…</div>}

        {comp.invoices.map((invoice) => (
          <div key={invoice.id} className="stack gap-8">
            <div className="row gap-8">
              <strong>NF-e {invoice.numero}/{invoice.serie}</strong>
              <span className="muted num" style={{ fontSize: 12.5 }}>{invoice.chave_acesso}</span>
              <span className="spacer" />
              <span className="num">{formatMoney(invoice.valor_total)}</span>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>NCM</th>
                    <th>Descrição</th>
                    <th>Tributação</th>
                    <th className="right">Base cálculo</th>
                    <th className="right">Imposto</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="num">{item.ncm}</td>
                      <td>{item.descricao}</td>
                      <td>
                        {item.tributacao ? (
                          TRIBUTACAO_ANTECIPACAO_LABEL[item.tributacao] ?? item.tributacao
                        ) : (
                          <Badge variant="warn">Pendente</Badge>
                        )}
                      </td>
                      <td className="right num">{formatMoney(item.base_calculo)}</td>
                      <td className="right num">{formatMoney(item.imposto_calculado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
