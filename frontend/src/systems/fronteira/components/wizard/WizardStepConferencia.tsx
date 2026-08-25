import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Spinner } from "@fronteira-ui";
import { ChevronDown } from "lucide-react";
import { useAplicarExcecoesWizard, type WizardExcecaoResult } from "../../hooks/queries";
import { useLoader } from "../LoaderOverlay";
import { formatMoney, formatRate } from "../../lib/format";
import { groupKeyForInvoice, type InvoiceGroup, type NFeParsed, type TaggedItem } from "./types";

function isEligible(cfop: string): boolean {
  return cfop.startsWith("6");
}

interface RowStatus {
  calculavel: boolean;
  badge: "ok" | "neutral" | "err";
  label: string;
  motivo: string;
}

/** Etapa 3 do wizard multi-nota: as notas do envio agrupadas em duas abas —
 * "A Calcular" (com ≥1 item elegível) e "Mesmo Estado / Ignoradas" (nenhum
 * item elegível). Cada nota é uma linha colapsável que expande para a tabela
 * de itens. A elegibilidade (CFOP de entrada + UF distinta + exceções) é
 * calculada por nota, não pelo lote todo. */
export function WizardStepConferencia({
  invoices,
  groups,
  onNext,
  onBack,
}: {
  invoices: NFeParsed[];
  groups: InvoiceGroup[];
  onNext: (eligibleItems: TaggedItem[]) => void;
  onBack: () => void;
}) {
  const aplicar = useAplicarExcecoesWizard();
  const loader = useLoader();
  const [excecoesPorNota, setExcecoesPorNota] = useState<Record<string, Record<number, WizardExcecaoResult>>>({});
  const [loaded, setLoaded] = useState(false);
  const [aviso, setAviso] = useState("");
  const [tab, setTab] = useState<"calcular" | "ignoradas">("calcular");
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  useEffect(() => {
    let ativo = true;
    let overlayVisivel = true;
    const esconder = () => {
      if (!overlayVisivel) return;
      overlayVisivel = false;
      loader.hide();
    };
    setLoaded(false);
    loader.show("Verificando exceções fiscais…");
    Promise.all(
      invoices.map(async (nfe) => {
        try {
          const res = await aplicar.mutateAsync(
            nfe.items.map((i) => ({ numero_item: i.numero_item, ncm: i.ncm, cfop: i.cfop, cst: i.cst })),
          );
          return [nfe.chave_nfe, res] as const;
        } catch {
          return [nfe.chave_nfe, null] as const;
        }
      }),
    ).then((pares) => {
      if (!ativo) return;
      const map: Record<string, Record<number, WizardExcecaoResult>> = {};
      let algumaFalhou = false;
      for (const [chave, res] of pares) {
        if (res === null) {
          algumaFalhou = true;
          continue;
        }
        map[chave] = Object.fromEntries(res.map((r) => [r.numero_item, r]));
      }
      setExcecoesPorNota(map);
      if (algumaFalhou) {
        setAviso("Não foi possível verificar exceções fiscais de uma ou mais notas agora — o /wizard/finalizar também as aplica no servidor, então nada será calculado indevidamente.");
      }
      setLoaded(true);
      esconder();
    });
    return () => {
      ativo = false;
      esconder();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

  function companyIdOf(nfe: NFeParsed): number | null {
    const key = groupKeyForInvoice(nfe.destinatario_cnpj, nfe.competencia);
    return groups.find((g) => g.key === key)?.companyId ?? null;
  }

  function statusOf(nfe: NFeParsed, item: NFeParsed["items"][number]): RowStatus {
    const sameState = nfe.emitente_uf !== "" && nfe.emitente_uf === nfe.destinatario_uf;
    if (sameState) {
      return { calculavel: false, badge: "neutral", label: "Ignorado", motivo: `Mesma UF (${nfe.emitente_uf})` };
    }
    const exc = excecoesPorNota[nfe.chave_nfe]?.[item.numero_item];
    if (exc?.ignorado) {
      const alvo = `${(exc.excecao_tipo ?? "").toUpperCase()} ${exc.excecao_valor ?? ""}`.trim();
      const motivo = exc.excecao_motivo ? `Exceção ${alvo} — ${exc.excecao_motivo}` : `Exceção fiscal (${alvo})`;
      return { calculavel: false, badge: "err", label: "Ignorado (exceção)", motivo };
    }
    if (!isEligible(item.cfop)) {
      return { calculavel: false, badge: "neutral", label: "Ignorado", motivo: "CFOP de entrada não elegível" };
    }
    return { calculavel: true, badge: "ok", label: "Calculável", motivo: "" };
  }

  // Uma "nota conferida": a NF-e com seus itens já rotulados por status, mais
  // a contagem de itens calculáveis (define em qual aba ela cai).
  const notasConferidas = useMemo(
    () =>
      invoices.map((nfe) => {
        const linhas = nfe.items.map((item) => ({ item, status: statusOf(nfe, item) }));
        const calculaveis = linhas.filter((l) => l.status.calculavel).length;
        return { nfe, linhas, calculaveis };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, excecoesPorNota],
  );

  const eligibleItems: TaggedItem[] = notasConferidas
    .flatMap((n) => n.linhas.filter((l) => l.status.calculavel).map((l) => ({ nfe: n.nfe, item: l.item })))
    .map(({ nfe, item }) => {
      const companyId = companyIdOf(nfe);
      return { ...item, chave_nfe: nfe.chave_nfe, companyId: companyId as number };
    })
    .filter((i) => i.companyId != null);

  const aCalcular = notasConferidas.filter((n) => n.calculaveis > 0);
  const ignoradas = notasConferidas.filter((n) => n.calculaveis === 0);
  const totalItensCalculaveis = notasConferidas.reduce((acc, n) => acc + n.calculaveis, 0);
  const ignoradosPorExcecao = notasConferidas
    .flatMap((n) => n.linhas)
    .filter((l) => l.status.label === "Ignorado (exceção)").length;
  const podeAvancar = loaded && eligibleItems.length > 0;
  const notasVisiveis = tab === "calcular" ? aCalcular : ignoradas;

  function toggle(chave: string) {
    setAbertas((s) => {
      const n = new Set(s);
      n.has(chave) ? n.delete(chave) : n.add(chave);
      return n;
    });
  }

  return (
    <div className="card">
      <div className="card-head" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
        <h2 className="page-title">Conferência de Lote</h2>
        <span className="page-sub">
          {invoices.length} nota(s) · {totalItensCalculaveis} item(ns) calculável(is)
        </span>
      </div>

      <div className="wizard-tabs">
        <button className={`wizard-tab ${tab === "calcular" ? "active" : ""}`} onClick={() => setTab("calcular")}>
          A Calcular <span className="count">{aCalcular.length}</span>
        </button>
        <button className={`wizard-tab ${tab === "ignoradas" ? "active" : ""}`} onClick={() => setTab("ignoradas")}>
          Mesmo Estado / Ignoradas <span className="count">{ignoradas.length}</span>
        </button>
      </div>

      <div className="card-body stack gap-12">
        {!loaded && (
          <div className="empty row gap-8" style={{ justifyContent: "center", alignItems: "center" }}>
            <Spinner size="md" />
            Verificando exceções fiscais…
          </div>
        )}
        {loaded && eligibleItems.length === 0 && (
          <div className="alert alert-danger">Nenhum item elegível para cálculo neste envio.</div>
        )}
        {ignoradosPorExcecao > 0 && (
          <div className="alert alert-warn">
            {ignoradosPorExcecao} item(ns) foram <strong>ignorados por exceção fiscal</strong> e não entram no cálculo.
          </div>
        )}
        {aviso && <div className="alert alert-danger">{aviso}</div>}

        {loaded && notasVisiveis.length === 0 && (
          <div className="empty">
            {tab === "calcular" ? "Nenhuma nota com item calculável." : "Nenhuma nota ignorada neste envio."}
          </div>
        )}

        {notasVisiveis.map(({ nfe, linhas, calculaveis }) => {
          const aberta = abertas.has(nfe.chave_nfe);
          return (
            <div key={nfe.chave_nfe} className="note-row">
              <button className="note-head" aria-expanded={aberta} onClick={() => toggle(nfe.chave_nfe)}>
                <span className="chev">
                  <ChevronDown size={16} />
                </span>
                <strong className="num">NF-e Nº {nfe.numero}</strong>
                <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                  {nfe.destinatario_nome}
                </span>
                {nfe.emitente_uf && <span className="uf-pill">{nfe.emitente_uf}</span>}
                <span className="muted num" style={{ fontSize: 12.5 }}>{nfe.emissao?.slice(0, 10)}</span>
                <span className="spacer" />
                <strong className="num">{formatMoney(nfe.valor_total)}</strong>
                <Badge variant={calculaveis > 0 ? "ok" : "neutral"}>{linhas.length} item(ns)</Badge>
              </button>

              {aberta && (
                <div className="note-body table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>NCM</th>
                        <th>CFOP</th>
                        <th>Descrição</th>
                        <th className="right">Valor</th>
                        <th className="right">Alíq. ICMS</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map(({ item, status }) => (
                        <tr key={item.numero_item}>
                          <td className="num">{item.ncm}</td>
                          <td className="num">{item.cfop}</td>
                          <td>{item.descricao}</td>
                          <td className="right num">{formatMoney(item.valor_total)}</td>
                          <td className="right num">{formatRate(item.aliq_icms)}</td>
                          <td>
                            <div className="stack" style={{ gap: 2 }}>
                              <Badge variant={status.badge}>{status.label}</Badge>
                              {status.motivo && (
                                <span className="muted" style={{ fontSize: 11.5 }}>{status.motivo}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "space-between" }}>
        <Button variant="ghost" onClick={onBack}>
          ← Voltar
        </Button>
        <Button variant="primary" disabled={!podeAvancar} loading={!loaded} onClick={() => onNext(eligibleItems)}>
          {loaded ? `Continuar para Classificação (${eligibleItems.length}) →` : "Verificando exceções…"}
        </Button>
      </div>
    </div>
  );
}
