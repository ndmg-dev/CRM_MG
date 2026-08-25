import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Checkbox, Select, Spinner } from "@fronteira-ui";
import {
  useAntecipacaoCompetencia,
  useAntecipacaoPendentes,
  useAntecipacaoSugestoes,
  useAntecipacaoTributacoes,
  useClassificarAntecipacaoItem,
  useClassificarLoteAntecipacao,
  useProcessarAntecipacao,
  TRIBUTACAO_ANTECIPACAO_LABEL,
} from "../../hooks/queries";
import { apiError } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { useLoader } from "../LoaderOverlay";

function competenciaLabel(competencia: string): string {
  return `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;
}

/** Passo Classificação (por apuração empresa+competência): itens pendentes
 * (não achados na memória) com dropdown por item + classificação em lote +
 * "aplicar memória" + barra de progresso. Reporta quantos pendentes restam
 * pro passo pai liberar o "Avançar". */
export function ClassificacaoGrupo({
  companyId,
  competencia,
  nomeEmpresa,
  onPendentes,
  skipAutomaticoInicial = false,
  onSkipAutomaticoConsumido,
}: {
  companyId: number;
  competencia: string;
  nomeEmpresa?: string;
  onPendentes: (companyId: number, competencia: string, pendentes: number | null) => void;
  skipAutomaticoInicial?: boolean;
  onSkipAutomaticoConsumido?: (companyId: number, competencia: string) => void;
}) {
  const loader = useLoader();
  const {
    data: comp,
    error: compError,
    isFetching: compFetching,
    refetch: refetchComp,
  } = useAntecipacaoCompetencia(companyId, competencia);
  const {
    data: pendentes,
    error: pendentesError,
    isFetching: pendentesFetching,
    refetch: refetchPendentes,
  } = useAntecipacaoPendentes(companyId, competencia);
  const { data: tributacoes } = useAntecipacaoTributacoes(true);
  const { data: sugestoes } = useAntecipacaoSugestoes(companyId, competencia);
  const processar = useProcessarAntecipacao(companyId, competencia);
  const classificar = useClassificarAntecipacaoItem(companyId, competencia);
  const classificarLote = useClassificarLoteAntecipacao(companyId, competencia);

  const tributacaoOptions = (tributacoes ?? []).map((t) => ({ value: t.codigo, label: t.nome }));
  const padrao = tributacoes?.find((t) => t.padrao)?.codigo ?? tributacoes?.[0]?.codigo ?? "normal_205";

  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [porItem, setPorItem] = useState<Record<number, string>>({});
  const [bulkTrib, setBulkTrib] = useState(padrao);
  const [error, setError] = useState("");
  const automaticoKeyRef = useRef<string | null>(null);
  const [automaticoConcluidoKey, setAutomaticoConcluidoKey] = useState<string | null>(null);

  const grupoKey = `${companyId}-${competencia}`;
  const totalItens = comp?.total_itens ?? 0;
  const queriesCarregando = compFetching || pendentesFetching || comp === undefined || pendentes === undefined;
  const queryError = compError ?? pendentesError;
  const automaticoConcluido = automaticoConcluidoKey === grupoKey;
  const atualizando = queriesCarregando || processar.isPending || (!automaticoConcluido && !error);
  const nPendentes = pendentes?.length ?? 0;
  const classificados = Math.max(0, totalItens - nPendentes);
  const pct = totalItens > 0 ? Math.round((classificados / totalItens) * 100) : 0;

  useEffect(() => {
    onPendentes(companyId, competencia, atualizando || queryError || error ? null : nPendentes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nPendentes, companyId, competencia, atualizando, queryError]);

  useEffect(() => {
    const key = `${companyId}-${competencia}`;
    if (automaticoKeyRef.current === key) return;
    automaticoKeyRef.current = key;

    // O wizard acabou de processar este grupo no mesmo loader da importação.
    // Consome a dispensa uma única vez; remontagens futuras reaplicam a memória.
    if (skipAutomaticoInicial) {
      setAutomaticoConcluidoKey(key);
      onSkipAutomaticoConsumido?.(companyId, competencia);
      return;
    }

    let ativo = true;
    setError("");
    loader
      .run("Aplicando a memória à classificação…", () => processar.mutateAsync())
      .then(() => {
        if (ativo) setAutomaticoConcluidoKey(key);
      })
      .catch((err) => {
        if (ativo) setError(apiError(err, "Não foi possível aplicar a memória automaticamente."));
      });
    return () => {
      ativo = false;
    };
    // A chave controla a reentrada. O ref impede repetição por rerender/StrictMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, competencia]);

  const sugestoesPorItem = useMemo(() => {
    const mapa = new Map<number, { company_nome: string; tributacao: string }[]>();
    for (const s of sugestoes ?? []) {
      const lista = mapa.get(s.item_id) ?? [];
      lista.push({ company_nome: s.company_nome, tributacao: s.tributacao });
      mapa.set(s.item_id, lista);
    }
    return mapa;
  }, [sugestoes]);

  const idsVisiveis = useMemo(() => (pendentes ?? []).map((p) => p.item_id), [pendentes]);
  const todosSelecionados = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id));

  function toggle(id: number) {
    setSelecionados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleTodos(check: boolean) {
    setSelecionados(check ? new Set(idsVisiveis) : new Set());
  }

  async function handleAplicarMemoria() {
    setError("");
    try {
      await loader.run("Aplicando a memória à classificação…", () => processar.mutateAsync());
      setAutomaticoConcluidoKey(`${companyId}-${competencia}`);
    } catch (err) {
      setError(apiError(err, "Não foi possível aplicar a memória."));
    }
  }

  async function handleRetryQueries() {
    setError("");
    await Promise.all([refetchComp(), refetchPendentes()]);
  }

  async function handleClassificarItem(itemId: number) {
    setError("");
    try {
      await classificar.mutateAsync({ itemId, tributacao: porItem[itemId] ?? padrao });
    } catch (err) {
      setError(apiError(err, "Não foi possível classificar o item."));
    }
  }

  async function handleClassificarLote() {
    if (selecionados.size === 0) return;
    setError("");
    const total = selecionados.size;
    try {
      await loader.run(`Classificando ${total} item(ns)…`, () =>
        classificarLote.mutateAsync({ itemIds: [...selecionados], tributacao: bulkTrib }),
      );
      setSelecionados(new Set());
    } catch (err) {
      setError(apiError(err, "Não foi possível classificar em lote."));
    }
  }

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="stack" style={{ gap: 4 }}>
          <h2 style={{ fontSize: 14 }}>
            {nomeEmpresa ? `${nomeEmpresa} · ` : ""}
            {competenciaLabel(competencia)}
          </h2>
          <div className="row gap-8" style={{ alignItems: "center" }}>
            <div style={{ width: 160, height: 6, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary)", transition: "width 160ms ease" }} />
            </div>
            <span className="muted" style={{ fontSize: 12 }}>
              {classificados}/{totalItens} classificados
            </span>
          </div>
        </div>
        <Badge variant={queryError || error || nPendentes > 0 ? "warn" : atualizando ? "neutral" : "ok"}>
          {queryError
            ? "Erro ao carregar"
            : error
              ? "Ação necessária"
            : atualizando
              ? "Atualizando…"
              : nPendentes > 0
                ? `${nPendentes} pendente(s)`
                : "Tudo classificado"}
        </Badge>
      </div>

      <div className="card-body stack gap-12">
        {error && <div className="alert alert-danger">{error}</div>}

        {queryError ? (
          <div className="alert alert-danger">
            <div>Não foi possível carregar a classificação.</div>
            <Button variant="ghost" size="sm" onClick={handleRetryQueries}>
              Tentar novamente
            </Button>
          </div>
        ) : atualizando ? (
          <div className="empty stack gap-12" style={{ alignItems: "center" }}>
            <Spinner size="lg" aria-label="Carregando classificação" />
            <strong>Carregando classificação…</strong>
            <span className="muted" style={{ fontSize: 13 }}>Buscando os itens da apuração e aplicando a memória.</span>
          </div>
        ) : nPendentes === 0 ? (
          <div className="empty">Nenhum item pendente nesta apuração.</div>
        ) : (
          <>
            <div className="row gap-8" style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
              <Button variant="ghost" size="sm" disabled={processar.isPending} loading={processar.isPending} onClick={handleAplicarMemoria}>
                {processar.isPending ? "Aplicando…" : "Aplicar memória automaticamente"}
              </Button>
              <div className="row gap-8" style={{ alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 12.5 }}>Em lote ({selecionados.size}):</span>
                <Select aria-label="Tributação em lote" value={bulkTrib} onValueChange={setBulkTrib} options={tributacaoOptions} />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={selecionados.size === 0 || classificarLote.isPending}
                  onClick={handleClassificarLote}
                >
                  Classificar selecionados
                </Button>
              </div>
            </div>

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>
                      <Checkbox checked={todosSelecionados} onCheckedChange={(v) => toggleTodos(!!v)} />
                    </th>
                    <th>Nota</th>
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
                    <tr key={item.item_id}>
                      <td>
                        <Checkbox checked={selecionados.has(item.item_id)} onCheckedChange={() => toggle(item.item_id)} />
                      </td>
                      <td className="num">{item.numero_nota}</td>
                      <td className="num">{item.ncm}</td>
                      <td>{item.descricao}</td>
                      <td className="num">{item.cfop}</td>
                      <td className="right num">{formatMoney(item.valor_produto)}</td>
                      <td>
                        <Select
                          aria-label="Tributação"
                          value={porItem[item.item_id] ?? padrao}
                          onValueChange={(v) => setPorItem((s) => ({ ...s, [item.item_id]: v }))}
                          options={tributacaoOptions}
                        />
                        {sugestoesPorItem.has(item.item_id) && (
                          <div style={{ marginTop: 4, fontSize: 11.5 }}>
                            {sugestoesPorItem.get(item.item_id)!.map((s, i) => (
                              <button
                                key={i}
                                type="button"
                                className="muted"
                                style={{
                                  background: "none", border: "none", padding: 0, cursor: "pointer",
                                  textDecoration: "underline", display: "block",
                                }}
                                title={`Usar a classificação de ${s.company_nome}`}
                                onClick={() => setPorItem((prev) => ({ ...prev, [item.item_id]: s.tributacao }))}
                              >
                                {s.company_nome} usou {TRIBUTACAO_ANTECIPACAO_LABEL[s.tributacao] ?? s.tributacao}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={classificar.isPending}
                          onClick={() => handleClassificarItem(item.item_id)}
                        >
                          Classificar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
