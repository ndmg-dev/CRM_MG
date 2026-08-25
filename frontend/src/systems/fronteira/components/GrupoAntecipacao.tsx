import { useEffect, useRef, useState } from "react";
import { Badge, Button, Select } from "@fronteira-ui";
import {
  TRIBUTACAO_ANTECIPACAO_LABEL,
  useAntecipacaoCompetencia,
  useAntecipacaoPendentes,
  useAntecipacaoTributacoes,
  useCalcularAntecipacao,
  useClassificarAntecipacaoItem,
  useExportAntecipacao,
  useProcessarAntecipacao,
} from "../hooks/queries";
import { useAuth } from "../auth/AuthContext";
import { apiError } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useLoader } from "./LoaderOverlay";

const SITUACAO_LABEL: Record<string, string> = {
  aguardando_classificacao: "Aguardando classificação",
  pronto_para_calcular: "Pronto para calcular",
  calculado: "Calculado",
};

const SITUACAO_VARIANT: Record<string, "ok" | "neutral" | "warn"> = {
  aguardando_classificacao: "warn",
  pronto_para_calcular: "neutral",
  calculado: "ok",
};

function competenciaLabel(competencia: string): string {
  return `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;
}

function ClassificarLinha({
  companyId,
  competencia,
  item,
}: {
  companyId: number;
  competencia: string;
  item: { item_id: number; ncm: string; descricao: string; cfop: string; valor_produto: string };
}) {
  const [tributacao, setTributacao] = useState("normal_205");
  const classificar = useClassificarAntecipacaoItem(companyId, competencia);
  const { data: tributacoes } = useAntecipacaoTributacoes(true);
  const tributacaoOptions = (tributacoes ?? []).map((t) => ({ value: t.codigo, label: t.nome }));
  const [error, setError] = useState("");

  async function handleClassificar() {
    setError("");
    try {
      await classificar.mutateAsync({ itemId: item.item_id, tributacao });
    } catch (err) {
      setError(apiError(err, "Não foi possível classificar o item."));
    }
  }

  return (
    <tr>
      <td className="num">{item.ncm}</td>
      <td>{item.descricao}</td>
      <td className="num">{item.cfop}</td>
      <td className="right num">{formatMoney(item.valor_produto)}</td>
      <td>
        <Select aria-label="Tributação" value={tributacao} onValueChange={setTributacao} options={tributacaoOptions} />
      </td>
      <td className="right">
        <Button variant="primary" size="sm" disabled={classificar.isPending} onClick={handleClassificar}>
          {classificar.isPending ? "Salvando…" : "Classificar"}
        </Button>
        {error && <div className="field-hint" style={{ color: "var(--danger)" }}>{error}</div>}
      </td>
    </tr>
  );
}

/** Uma apuração de Antecipação = (empresa, competência). Mostra resumo,
 * itens pendentes de classificação, cálculo e export XLSX. Usado tanto no
 * resultado do wizard (um por grupo) quanto na navegação direta a partir do
 * Histórico. As notas já foram persistidas antes (import) — aqui não há
 * upload. `nomeEmpresa` é opcional (o wizard já conhece o nome do XML). */
export function GrupoAntecipacao({
  companyId,
  competencia,
  nomeEmpresa,
}: {
  companyId: number;
  competencia: string;
  nomeEmpresa?: string;
}) {
  const { isCoordenador } = useAuth();
  const { data: comp, isLoading, error } = useAntecipacaoCompetencia(companyId, competencia);
  const { data: pendentes } = useAntecipacaoPendentes(
    comp?.situacao === "aguardando_classificacao" ? companyId : null,
    competencia,
  );
  const processar = useProcessarAntecipacao(companyId, competencia);
  const calcular = useCalcularAntecipacao(companyId, competencia);
  const exportar = useExportAntecipacao();
  const [actionError, setActionError] = useState("");
  const automaticoKeyRef = useRef<string | null>(null);
  const loader = useLoader();

  useEffect(() => {
    if (comp?.situacao !== "aguardando_classificacao" || comp.total_itens === 0) return;
    const key = `${companyId}-${competencia}`;
    if (automaticoKeyRef.current === key) return;
    automaticoKeyRef.current = key;

    let ativo = true;
    setActionError("");
    loader
      .run("Aplicando a memória à classificação…", () => processar.mutateAsync())
      .catch((err) => {
        if (ativo) setActionError(apiError(err, "Não foi possível aplicar a memória automaticamente."));
      });
    return () => {
      ativo = false;
    };
    // O helper compartilhado deduplica StrictMode; a chave libera nova reentrada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, competencia, comp?.situacao, comp?.total_itens]);

  async function handleProcessar() {
    setActionError("");
    try {
      await processar.mutateAsync();
    } catch (err) {
      setActionError(apiError(err, "Não foi possível aplicar a memória."));
    }
  }

  async function handleCalcular() {
    setActionError("");
    try {
      await calcular.mutateAsync();
    } catch (err) {
      setActionError(apiError(err, "Não foi possível calcular."));
    }
  }

  async function handleExport() {
    setActionError("");
    try {
      await exportar.mutateAsync({ companyId, competencia });
    } catch (err) {
      setActionError(apiError(err, "Não foi possível exportar o XLSX."));
    }
  }

  if (isLoading) return <div className="empty">Carregando…</div>;
  if (error || !comp) {
    return (
      <div className="empty">
        <strong>Não foi possível carregar</strong>
        {apiError(error)}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2 style={{ fontSize: 14 }}>
            {nomeEmpresa ? `${nomeEmpresa} · ` : ""}
            {competenciaLabel(competencia)}
          </h2>
          <span className="page-sub">
            {comp.total_notas} nota(s) · {comp.total_itens} item(ns) · {formatMoney(comp.total_imposto)}
          </span>
        </div>
        <div className="row gap-8">
          {comp.situacao === "calculado" && (
            <Button variant="ghost" size="sm" disabled={exportar.isPending} onClick={handleExport}>
              {exportar.isPending ? "Exportando…" : "Exportar XLSX"}
            </Button>
          )}
          <Badge variant={SITUACAO_VARIANT[comp.situacao]}>{SITUACAO_LABEL[comp.situacao] ?? comp.situacao}</Badge>
        </div>
      </div>

      <div className="card-body stack gap-16">
        {actionError && <div className="alert alert-danger">{actionError}</div>}

        {isCoordenador && comp.situacao === "aguardando_classificacao" && comp.total_itens > 0 && (
          <div className="row gap-8" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Aplique a memória para pré-classificar os itens com NCM/descrição já conhecidos.
            </span>
            <Button variant="primary" size="sm" disabled={processar.isPending} onClick={handleProcessar}>
              {processar.isPending ? "Aplicando…" : "Aplicar memória automaticamente"}
            </Button>
          </div>
        )}

        {isCoordenador && comp.situacao === "pronto_para_calcular" && (
          <div className="row gap-8" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 13 }}>Todos os itens já foram classificados.</span>
            <Button variant="primary" size="sm" disabled={calcular.isPending} onClick={handleCalcular}>
              {calcular.isPending ? "Calculando…" : "Calcular"}
            </Button>
          </div>
        )}

        {comp.situacao === "aguardando_classificacao" && (pendentes?.length ?? 0) > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>NCM</th>
                  <th>Descrição</th>
                  <th>CFOP</th>
                  <th className="right">Valor</th>
                  <th>Tributação</th>
                  <th className="right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pendentes!.map((item) => (
                  <ClassificarLinha key={item.item_id} companyId={companyId} competencia={competencia} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {comp.invoices.length > 0 && (
          <div className="stack gap-24">
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
        )}
      </div>
    </div>
  );
}
