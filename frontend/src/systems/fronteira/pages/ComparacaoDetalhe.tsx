import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge, Button, Input } from "@fronteira-ui";
import {
  COMPARACAO_STATUS_LABEL,
  COMPARACAO_STATUS_VARIANT,
  useComparacao,
  useExportComparacao,
  useSalvarObservacoes,
} from "../hooks/queries";
import { useAuth } from "../auth/AuthContext";
import { apiError } from "../lib/api";
import { formatMoney } from "../lib/format";

function money(v: string | null): string {
  return v == null ? "—" : formatMoney(v);
}

export default function ComparacaoDetalhe() {
  const { id } = useParams();
  const comparacaoId = id ? Number(id) : null;
  const { isCoordenador } = useAuth();

  const { data: comp, isLoading, error } = useComparacao(comparacaoId);
  const salvar = useSalvarObservacoes(comparacaoId ?? 0);
  const exportar = useExportComparacao();

  const [obs, setObs] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (comp) {
      const init: Record<number, string> = {};
      for (const item of comp.items) init[item.id] = item.observacao;
      setObs(init);
    }
  }, [comp]);

  async function handleSalvar() {
    setActionError("");
    if (!comp) return;
    const observacoes = comp.items
      .filter((i) => (obs[i.id] ?? "") !== i.observacao)
      .map((i) => ({ item_id: i.id, observacao: obs[i.id] ?? "" }));
    if (observacoes.length === 0) return;
    try {
      await salvar.mutateAsync(observacoes);
    } catch (err) {
      setActionError(apiError(err, "Não foi possível salvar as observações."));
    }
  }

  async function handleExport() {
    setActionError("");
    try {
      await exportar.mutateAsync(comparacaoId!);
    } catch (err) {
      setActionError(apiError(err, "Não foi possível exportar o XLSX."));
    }
  }

  if (isLoading) return <div className="empty">Carregando…</div>;
  if (error || !comp) {
    return (
      <div className="empty">
        <strong>Não foi possível carregar a comparação</strong>
        {apiError(error)}
      </div>
    );
  }

  const counters: { label: string; value: number; variant: "ok" | "warn" | "err" | "neutral" }[] = [
    { label: "OK", value: comp.total_ok, variant: "ok" },
    { label: "Tolerância", value: comp.total_tolerancia, variant: "warn" },
    { label: "Divergente", value: comp.total_divergente, variant: "err" },
    { label: "CNPJ diferente", value: comp.total_match_parcial, variant: "warn" },
    { label: "Apenas SEFAZ", value: comp.total_apenas_sefaz, variant: "neutral" },
    { label: "Apenas Sistema", value: comp.total_apenas_sistema, variant: "neutral" },
  ];

  return (
    <div className="stack gap-16">
      <div className="row">
        <div>
          <h1 className="page-title">Comparação #{comp.id}</h1>
          <p className="page-sub">
            Competência {comp.competencia} · Extrato {comp.num_extrato || "—"} · {comp.arquivo_sefaz}
          </p>
        </div>
        <div className="spacer" />
        <Button variant="ghost" disabled={exportar.isPending} onClick={handleExport}>
          {exportar.isPending ? "Exportando…" : "Exportar XLSX"}
        </Button>
      </div>

      {actionError && <div className="alert alert-danger">{actionError}</div>}

      <div className="card">
        <div className="card-body">
          <div className="row gap-8" style={{ flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {comp.total_notas} nota(s) · tolerância {formatMoney(comp.tolerancia)} · IE {comp.ie_sefaz || "—"}
            </span>
            <span className="spacer" />
            {counters.map((c) => (
              <Badge key={c.label} variant={c.variant}>
                {c.label}: {c.value}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 style={{ fontSize: 14 }}>Notas conferidas</h2>
          {isCoordenador && (
            <Button variant="primary" size="sm" disabled={salvar.isPending} onClick={handleSalvar}>
              {salvar.isPending ? "Salvando…" : "Salvar observações"}
            </Button>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nº Nota</th>
                <th>Status</th>
                <th className="right">ICMS Sistema</th>
                <th className="right">ICMS SEFAZ</th>
                <th className="right">Diferença</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {comp.items.map((item) => (
                <tr key={item.id}>
                  <td className="num">{item.numero_nota}</td>
                  <td>
                    <Badge variant={COMPARACAO_STATUS_VARIANT[item.status] ?? "neutral"}>
                      {COMPARACAO_STATUS_LABEL[item.status] ?? item.status}
                    </Badge>
                  </td>
                  <td className="right num">{money(item.icms_sistema)}</td>
                  <td className="right num">{money(item.icms_sefaz)}</td>
                  <td className="right num">{money(item.diferenca)}</td>
                  <td>
                    {isCoordenador ? (
                      <Input
                        style={{ minWidth: 220 }}
                        value={obs[item.id] ?? ""}
                        onChange={(e) => setObs((o) => ({ ...o, [item.id]: e.target.value }))}
                        placeholder="Anotar…"
                      />
                    ) : (
                      item.observacao || "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
