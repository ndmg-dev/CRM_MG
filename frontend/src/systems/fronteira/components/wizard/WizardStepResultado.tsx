import { useEffect, useRef, useState } from "react";
import { Badge, Button, Spinner } from "@fronteira-ui";
import { ChevronDown } from "lucide-react";
import {
  useExportFronteira,
  useExportFronteiraGrupo,
  useExportFronteiraGrupoPdf,
  useExportFronteiraPdf,
  useExportFronteiraZip,
  useFinalizarWizard,
  type WizardFinalizarInput,
  type WizardItemIn,
  type WizardItemResultado,
} from "../../hooks/queries";
import { apiError } from "../../lib/api";
import { useLoader } from "../LoaderOverlay";
import { formatCNPJ, formatMoney, formatRate } from "../../lib/format";
import { classificationKey, type ClassificationRow, type InvoiceGroup, type NFeParsed, type TaggedItem } from "./types";

const COLSPAN = 10;

/** Linha de item na tabela de resultado + linha expansível com o
 * detalhamento do cálculo (entradas, parâmetros fiscais, fórmula e passos). */
function ResultItemRow({
  index,
  res,
  input,
  classe,
}: {
  index: number;
  res: WizardItemResultado;
  input?: TaggedItem;
  classe?: ClassificationRow;
}) {
  const [open, setOpen] = useState(false);
  const isST = res.formula_tipo === "st";
  return (
    <>
      <tr>
        <td>
          <div className="row gap-8">
            <span className="muted num">{index}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150, display: "inline-block" }}>
              {res.descricao}
            </span>
          </div>
        </td>
        <td className="num">{res.ncm}</td>
        <td className="num">{input?.cfop ?? "—"}</td>
        <td className="right num">{input ? formatMoney(input.valor_total) : "—"}</td>
        <td className="right num">{input ? formatMoney(input.valor_icms) : "—"}</td>
        <td><Badge variant="accent">{res.formula_nome}</Badge></td>
        <td className="num">{classe ? (isST ? `MVA ${classe.mva_original}` : `RBC ${classe.rbc}`) : "—"}</td>
        <td className="right num">{classe ? formatRate(classe.aliquota_interna) : "—"}</td>
        <td className="right imposto-cell">{formatMoney(res.valor_resultado)}</td>
        <td className="right">
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Fechar" : "Ver"}
          </Button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={COLSPAN} style={{ padding: 0 }}>
            <div className="detail-panel">
              {input && (
                <div className="detail-section">
                  <h4>Entradas do cálculo</h4>
                  <div className="detail-line"><span className="k">Valor produto</span><span className="v">{formatMoney(input.valor_total)}</span></div>
                  <div className="detail-line"><span className="k">IPI</span><span className="v">{formatMoney(input.valor_ipi)}</span></div>
                  <div className="detail-line"><span className="k">Frete</span><span className="v">{formatMoney(input.valor_frete)}</span></div>
                  <div className="detail-line"><span className="k">Despesas acess.</span><span className="v">{formatMoney(input.outras_despesas)}</span></div>
                  <div className="detail-line"><span className="k">Seguro</span><span className="v">{formatMoney(input.seguro)}</span></div>
                  <div className="detail-line"><span className="k">ICMS destacado</span><span className="v">{formatMoney(input.valor_icms)}</span></div>
                </div>
              )}
              {classe && (
                <div className="detail-section">
                  <h4>Parâmetros fiscais</h4>
                  <div className="detail-line"><span className="k">Alíq. interna (AI)</span><span className="v">{classe.aliquota_interna}</span></div>
                  <div className="detail-line"><span className="k">Alíq. ICMS origem</span><span className="v">{res.aliq_icms}</span></div>
                  <div className="detail-line"><span className="k">MVA</span><span className="v">{classe.mva_original}</span></div>
                  <div className="detail-line"><span className="k">RBC</span><span className="v">{classe.rbc}</span></div>
                </div>
              )}
              {res.formula && (
                <div className="detail-section full">
                  <h4>Fórmula</h4>
                  <div className="formula-block">{res.formula}</div>
                </div>
              )}
              {res.passos.length > 0 && (
                <div className="detail-section full">
                  <h4>Passos do cálculo</h4>
                  <table className="table">
                    <tbody>
                      {res.passos.map((p, i) => (
                        <tr key={i}>
                          <td className="num muted" style={{ width: 28 }}>{i + 1}</td>
                          <td>{p.descricao}</td>
                          <td className="num muted" style={{ fontSize: 12.5 }}>{p.formula}</td>
                          <td className="right num">{p.valor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function buildItemIn(item: TaggedItem, classificacao: ClassificationRow): WizardItemIn {
  return {
    numero_item: item.numero_item,
    ncm: item.ncm,
    cfop: item.cfop,
    cst: item.cst,
    origem: item.origem,
    descricao: item.descricao,
    tributacao: classificacao.tributacao,
    utilizacao: classificacao.utilizacao,
    valor_total: item.valor_total,
    valor_ipi: item.valor_ipi,
    valor_frete: item.valor_frete,
    outras_despesas: item.outras_despesas,
    seguro: item.seguro,
    valor_icms: item.valor_icms,
    valor_icms_st: item.valor_icms_st,
    aliq_icms: item.aliq_icms,
    aliquota_interna: classificacao.aliquota_interna,
    mva_original: classificacao.mva_original,
    mva_4: classificacao.mva_4,
    mva_7: classificacao.mva_7,
    mva_12: classificacao.mva_12,
    rbc: classificacao.rbc,
  };
}

export interface NotaResultado {
  nfe: NFeParsed;
  companyId: number;
  invoiceId: number;
  totalDifal: number;
  itens: WizardItemResultado[];
}

/** Etapa 5 do wizard multi-nota: cada nota é calculada e persistida
 * individualmente, mas o resultado é exibido agrupado por empresa +
 * competência, com um cartão por nota (cabeçalho NF/Imposto + tabela de
 * itens com detalhamento expansível) e o total geral do envio. */
export function WizardStepResultado({
  groups,
  eligibleItems,
  classification,
  resultadosSalvos,
  onResultados,
  onBack,
  onRestart,
}: {
  groups: InvoiceGroup[];
  eligibleItems: TaggedItem[];
  classification: Record<string, ClassificationRow>;
  // Resultado já finalizado nesta sessão — se presente, NÃO refinaliza (o
  // `/wizard/finalizar` não é idempotente: refinalizar duplicaria notas). Assim
  // voltar do Resultado e retornar apenas re-exibe o que já foi calculado.
  resultadosSalvos: NotaResultado[] | null;
  onResultados: (r: NotaResultado[]) => void;
  onBack: () => void;
  onRestart: () => void;
}) {
  const finalizar = useFinalizarWizard();
  const exportar = useExportFronteira();
  const exportarPdf = useExportFronteiraPdf();
  const exportarGrupo = useExportFronteiraGrupo();
  const exportarGrupoPdf = useExportFronteiraGrupoPdf();
  const exportarZip = useExportFronteiraZip();
  const loader = useLoader();
  const [error, setError] = useState("");
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState<NotaResultado[] | null>(resultadosSalvos);
  const [notasAbertas, setNotasAbertas] = useState<Set<number>>(
    new Set((resultadosSalvos ?? []).map((n) => n.invoiceId)),
  );
  const iniciadoRef = useRef(false);

  const notasParaCalcular = groups.flatMap((g) =>
    g.invoices
      .filter((nfe) => eligibleItems.some((i) => i.chave_nfe === nfe.chave_nfe))
      .map((nfe) => ({ nfe, group: g })),
  );

  async function handleCalcular() {
    setError("");
    setProcessando(true);
    loader.show(`Calculando ICMS Fronteira (${notasParaCalcular.length} nota(s))…`);
    try {
      const acumulado: NotaResultado[] = [];
      for (const { nfe, group } of notasParaCalcular) {
        const itensDaNota = eligibleItems.filter((i) => i.chave_nfe === nfe.chave_nfe);
        const payload: WizardFinalizarInput = {
          company_id: group.companyId as number,
          competencia: nfe.competencia,
          numero: nfe.numero,
          serie: nfe.serie,
          chave_nfe: nfe.chave_nfe,
          emissao: nfe.emissao,
          valor_total: nfe.valor_total,
          valor_icms: nfe.valor_icms,
          uf_emitente: nfe.emitente_uf,
          uf_destinatario: nfe.destinatario_uf,
          items: itensDaNota.map((item) =>
            buildItemIn(item, classification[classificationKey(item.companyId, item.ncm, item.descricao)]),
          ),
        };
        const res = await finalizar.mutateAsync(payload);
        acumulado.push({
          nfe,
          companyId: group.companyId as number,
          invoiceId: res.invoice_id,
          totalDifal: Number(res.valor_difal_total),
          itens: res.itens,
        });
      }
      setResultados(acumulado);
      onResultados(acumulado);
      setNotasAbertas(new Set(acumulado.map((n) => n.invoiceId)));
    } catch (err) {
      setError(apiError(err, "Não foi possível calcular e salvar uma das notas."));
    } finally {
      setProcessando(false);
      loader.hide();
    }
  }

  // Dispara o cálculo automaticamente ao entrar nesta etapa — sem tela de
  // confirmação intermediária (igual ao v7). O guard evita disparo duplicado.
  // Se já há resultado salvo (voltou do Resultado e retornou), NÃO refinaliza —
  // apenas re-exibe (finalizar não é idempotente).
  useEffect(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;
    if (resultadosSalvos) return;
    handleCalcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExport(invoiceId: number) {
    setError("");
    try {
      await exportar.mutateAsync(invoiceId);
    } catch (err) {
      setError(apiError(err, "Não foi possível exportar o XLSX."));
    }
  }

  async function handleExportPdf(invoiceId: number) {
    setError("");
    try {
      await exportarPdf.mutateAsync(invoiceId);
    } catch (err) {
      setError(apiError(err, "Não foi possível exportar o PDF."));
    }
  }

  async function handleExportGrupo(companyId: number, competencia: string) {
    setError("");
    try {
      await exportarGrupo.mutateAsync({ companyId, competencia });
    } catch (err) {
      setError(apiError(err, "Não foi possível exportar a apuração."));
    }
  }

  async function handleExportGrupoPdf(companyId: number, competencia: string) {
    setError("");
    try {
      await exportarGrupoPdf.mutateAsync({ companyId, competencia });
    } catch (err) {
      setError(apiError(err, "Não foi possível exportar a apuração em PDF."));
    }
  }

  async function handleExportTudo(gruposExport: { company_id: number; competencia: string }[]) {
    setError("");
    try {
      await exportarZip.mutateAsync(gruposExport);
    } catch (err) {
      setError(apiError(err, "Não foi possível exportar tudo em ZIP."));
    }
  }

  function toggleNota(invoiceId: number) {
    setNotasAbertas((s) => {
      const n = new Set(s);
      n.has(invoiceId) ? n.delete(invoiceId) : n.add(invoiceId);
      return n;
    });
  }

  const totalGeral = (resultados ?? []).reduce((acc, r) => acc + r.totalDifal, 0);

  const resultadosPorGrupo = new Map<string, NotaResultado[]>();
  for (const r of resultados ?? []) {
    const grupo = groups.find((g) => g.companyId === r.companyId && g.invoices.some((n) => n.chave_nfe === r.nfe.chave_nfe));
    const key = grupo?.key ?? `${r.companyId}`;
    const lista = resultadosPorGrupo.get(key) ?? [];
    lista.push(r);
    resultadosPorGrupo.set(key, lista);
  }

  // Grupos distintos (empresa, competência) pro "Exportar tudo" — cada um vira
  // um XLSX dentro do ZIP.
  const gruposParaExport = [...resultadosPorGrupo.entries()].map(([key, notas]) => {
    const grupo = groups.find((g) => g.key === key);
    return { company_id: notas[0].companyId, competencia: grupo?.competencia ?? notas[0].nfe.competencia };
  });

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="page-title">Resultado do Cálculo</h2>
        {resultados && <Badge variant="accent">{resultados.length} nota(s) calculada(s)</Badge>}
      </div>
      <div className="card-body stack gap-16">
        {error && <div className="alert alert-danger">{error}</div>}

        {!resultados &&
          (processando ? (
            <div className="empty row gap-8" style={{ justifyContent: "center", alignItems: "center" }}>
              <Spinner size="md" />
              Calculando e salvando {notasParaCalcular.length} nota(s)…
            </div>
          ) : error ? (
            <Button variant="primary" style={{ justifyContent: "center" }} onClick={handleCalcular}>
              Tentar novamente
            </Button>
          ) : null)}

        {resultados && (
          <div className="stack gap-24">
            <div className="result-total">
              <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="muted">Total DIFAL do envio ({resultados.length} nota(s))</span>
                  <span className="num result-value">{formatMoney(totalGeral)}</span>
                </div>
                {gruposParaExport.length > 1 && (
                  <Button
                    variant="primary"
                    disabled={exportarZip.isPending}
                    loading={exportarZip.isPending}
                    onClick={() => handleExportTudo(gruposParaExport)}
                  >
                    {exportarZip.isPending ? "Gerando ZIP…" : `↓ Exportar tudo (ZIP · ${gruposParaExport.length} apurações)`}
                  </Button>
                )}
              </div>
            </div>

            {[...resultadosPorGrupo.entries()].map(([key, notas]) => {
              const grupo = groups.find((g) => g.key === key);
              const nomeEmpresa = grupo?.invoices[0]?.destinatario_nome ?? `Empresa #${notas[0].companyId}`;
              return (
                <div key={key} className="stack gap-12">
                  <div className="row gap-8" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div className="row gap-8">
                      <strong>{nomeEmpresa}</strong>
                      {grupo && <span className="muted num" style={{ fontSize: 12.5 }}>{formatCNPJ(grupo.cnpj)}</span>}
                      <span className="muted" style={{ fontSize: 12.5 }}>· competência {(grupo?.competencia ?? notas[0].nfe.competencia).slice(0, 7)}</span>
                    </div>
                    <div className="row gap-8">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={exportarGrupo.isPending}
                        loading={exportarGrupo.isPending}
                        onClick={() => handleExportGrupo(notas[0].companyId, grupo?.competencia ?? notas[0].nfe.competencia)}
                      >
                        ↓ Exportar apuração (XLSX)
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={exportarGrupoPdf.isPending}
                        loading={exportarGrupoPdf.isPending}
                        onClick={() => handleExportGrupoPdf(notas[0].companyId, grupo?.competencia ?? notas[0].nfe.competencia)}
                      >
                        ↓ PDF
                      </Button>
                    </div>
                  </div>

                  {notas.map((nota) => {
                    const aberta = notasAbertas.has(nota.invoiceId);
                    return (
                      <div key={nota.invoiceId} className="nf-card">
                        <div className="nf-card-head">
                          <button
                            className="row gap-8"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", font: "inherit", padding: 0 }}
                            aria-expanded={aberta}
                            onClick={() => toggleNota(nota.invoiceId)}
                          >
                            <span className="chev" style={{ display: "inline-flex", color: "var(--muted)", transition: "transform 120ms ease", transform: aberta ? "rotate(180deg)" : "none" }}>
                              <ChevronDown size={16} />
                            </span>
                            <strong className="num">NF-e Nº {nota.nfe.numero}</strong>
                            {nota.nfe.emitente_uf && <span className="uf-pill">{nota.nfe.emitente_uf}</span>}
                          </button>
                          <span className="spacer" />
                          <span className="mini-pill info">NF: <strong>{formatMoney(nota.nfe.valor_total)}</strong></span>
                          <span className="mini-pill accent">Imposto: <strong>{formatMoney(nota.totalDifal)}</strong></span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExport(nota.invoiceId)}
                            disabled={exportar.isPending}
                            loading={exportar.isPending}
                          >
                            XLSX
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportPdf(nota.invoiceId)}
                            disabled={exportarPdf.isPending}
                            loading={exportarPdf.isPending}
                          >
                            PDF
                          </Button>
                        </div>

                        {aberta && (
                          <div className="table-scroll">
                            <table className="table grid-table">
                              <thead>
                                <tr>
                                  <th>Produto</th>
                                  <th>NCM</th>
                                  <th>CFOP</th>
                                  <th className="right">V. Prod</th>
                                  <th className="right">ICMS Dest.</th>
                                  <th>Tributação</th>
                                  <th>MVA / RBC</th>
                                  <th className="right">Alíq. Int.</th>
                                  <th className="right">Imposto (ST)</th>
                                  <th className="right">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {nota.itens.map((item, i) => (
                                  <ResultItemRow
                                    key={item.numero_item}
                                    index={i + 1}
                                    res={item}
                                    input={eligibleItems.find((e) => e.chave_nfe === nota.nfe.chave_nfe && e.numero_item === item.numero_item)}
                                    classe={classification[classificationKey(nota.companyId, item.ncm, item.descricao)]}
                                  />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "space-between" }}>
        {resultados ? (
          <>
            <Button variant="ghost" onClick={onBack}>
              ← Voltar
            </Button>
            <Button variant="primary" onClick={onRestart}>
              Nova importação
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onBack} disabled={processando}>
              ← Voltar
            </Button>
            <span />
          </>
        )}
      </div>

      <style>{`
        .result-total { display: flex; flex-direction: column; gap: 4px; padding: 16px; background: var(--primary-tint); border-radius: 8px; }
        .result-value { font-size: 30px; font-weight: 600; color: var(--primary-strong); }
      `}</style>
    </div>
  );
}
