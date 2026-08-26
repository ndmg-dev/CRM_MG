import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Badge, Button } from "@fronteira-ui";
import { ChevronDown } from "lucide-react";
import {
  useExportFronteiraGrupo,
  useExportFronteiraGrupoPdf,
  useHistoricoDetalhe,
  type HistoricoItem,
  type HistoricoNota,
} from "../hooks/queries";
import { apiError } from "../lib/api";
import { formatCNPJ, formatMoney, formatRate } from "../lib/format";

const COLSPAN = 10;

function competenciaLabel(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

/** Linha de item + detalhamento expansível — mesmo visual da etapa de
 * Resultado do wizard, mas lendo do histórico já persistido. */
function ItemRow({ index, item }: { index: number; item: HistoricoItem }) {
  const [open, setOpen] = useState(false);
  const isST = item.formula_tipo === "st";
  return (
    <>
      <tr>
        <td>
          <div className="row gap-8">
            <span className="muted num">{index}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150, display: "inline-block" }}>
              {item.descricao}
            </span>
          </div>
        </td>
        <td className="num">{item.ncm}</td>
        <td className="num">{item.cfop}</td>
        <td className="right num">{formatMoney(item.valor_total)}</td>
        <td className="right num">{formatMoney(item.valor_icms)}</td>
        <td><Badge variant="accent">{item.formula_nome}</Badge></td>
        <td className="num">{isST ? `MVA ${item.mva_aplicada}` : `RBC ${item.rbc_aplicada}`}</td>
        <td className="right num">{formatRate(item.aliq_interna)}</td>
        <td className="right imposto-cell">{formatMoney(item.valor_resultado)}</td>
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
              <div className="detail-section">
                <h4>Entradas do cálculo</h4>
                <div className="detail-line"><span className="k">Valor produto</span><span className="v">{formatMoney(item.valor_total)}</span></div>
                <div className="detail-line"><span className="k">IPI</span><span className="v">{formatMoney(item.valor_ipi)}</span></div>
                <div className="detail-line"><span className="k">Frete</span><span className="v">{formatMoney(item.valor_frete)}</span></div>
                <div className="detail-line"><span className="k">Despesas acess.</span><span className="v">{formatMoney(item.outras_despesas)}</span></div>
                <div className="detail-line"><span className="k">Seguro</span><span className="v">{formatMoney(item.seguro)}</span></div>
                <div className="detail-line"><span className="k">ICMS destacado</span><span className="v">{formatMoney(item.valor_icms)}</span></div>
              </div>
              <div className="detail-section">
                <h4>Parâmetros fiscais</h4>
                <div className="detail-line"><span className="k">Alíq. interna (AI)</span><span className="v">{item.aliq_interna}</span></div>
                <div className="detail-line"><span className="k">Alíq. ICMS origem</span><span className="v">{item.aliq_icms}</span></div>
                <div className="detail-line"><span className="k">MVA</span><span className="v">{item.mva_aplicada}</span></div>
                <div className="detail-line"><span className="k">RBC</span><span className="v">{item.rbc_aplicada}</span></div>
              </div>
              {item.formula && (
                <div className="detail-section full">
                  <h4>Fórmula</h4>
                  <div className="formula-block">{item.formula}</div>
                </div>
              )}
              {item.passos.length > 0 && (
                <div className="detail-section full">
                  <h4>Passos do cálculo</h4>
                  <table className="table">
                    <tbody>
                      {item.passos.map((p, i) => (
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

function NotaCard({ nota }: { nota: HistoricoNota }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="nf-card">
      <div className="nf-card-head">
        <button
          className="row gap-8"
          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", font: "inherit", padding: 0 }}
          aria-expanded={aberta}
          onClick={() => setAberta((a) => !a)}
        >
          <span className="chev" style={{ display: "inline-flex", color: "var(--muted)", transition: "transform 120ms ease", transform: aberta ? "rotate(180deg)" : "none" }}>
            <ChevronDown size={16} />
          </span>
          <strong className="num">NF-e Nº {nota.numero}</strong>
          {nota.uf_emitente && <span className="uf-pill">{nota.uf_emitente}</span>}
        </button>
        <span className="spacer" />
        <span className="mini-pill info">NF: <strong>{formatMoney(nota.valor_total)}</strong></span>
        <span className="mini-pill accent">Imposto: <strong>{formatMoney(nota.total_difal)}</strong></span>
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
                <ItemRow key={item.numero_item} index={i + 1} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Detalhe de uma apuração do Histórico (empresa + competência) — mesma tela
 * do Resultado do wizard, só que lida do que já está salvo, com export. */
export default function HistoricoDetalhe() {
  const { companyId: companyIdRaw, competencia } = useParams();
  const companyId = companyIdRaw ? Number(companyIdRaw) : null;
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const { data, isLoading, error } = useHistoricoDetalhe(companyId, competencia ?? null);
  const exportar = useExportFronteiraGrupo();
  const exportarPdf = useExportFronteiraGrupoPdf();

  function exportarXlsx() {
    if (companyId != null && competencia) exportar.mutate({ companyId, competencia });
  }
  function exportarPdfFn() {
    if (companyId != null && competencia) exportarPdf.mutate({ companyId, competencia });
  }

  return (
    <div className="stack gap-16">
      <div className="row gap-8" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">
            Apuração {competencia ? competenciaLabel(competencia) : ""}
          </h1>
          <p className="page-sub">
            {data ? data.company_nome : ""} {data && <span className="num">{formatCNPJ(data.company_cnpj)}</span>}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate(toAbs("fronteira/historico"))}>
          ← Voltar ao histórico
        </Button>
      </div>

      {isLoading && <div className="empty">Carregando…</div>}
      {error && <div className="alert alert-danger">{apiError(error, "Não foi possível carregar a apuração.")}</div>}

      {data && (
        <div className="card">
          <div className="card-head">
            <h2 className="page-title" style={{ fontSize: 18 }}>Resultado do Cálculo</h2>
            <div className="row gap-8">
              <Badge variant="accent">{data.total_notas} nota(s)</Badge>
              <Button variant="primary" size="sm" disabled={exportar.isPending} onClick={exportarXlsx}>
                ↓ Exportar apuração (XLSX)
              </Button>
              <Button variant="primary" size="sm" disabled={exportarPdf.isPending} onClick={exportarPdfFn}>
                ↓ PDF
              </Button>
            </div>
          </div>

          <div className="card-body stack gap-16">
            <div className="result-total">
              <span className="muted">Total DIFAL da competência ({data.total_notas} nota(s))</span>
              <span className="num result-value">{formatMoney(data.total_difal)}</span>
            </div>

            {data.notas.map((nota) => (
              <NotaCard key={nota.invoice_id} nota={nota} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        .result-total { display: flex; flex-direction: column; gap: 4px; padding: 16px; background: var(--primary-tint); border-radius: 8px; }
        .result-value { font-size: 30px; font-weight: 600; color: var(--primary-strong); }
      `}</style>
    </div>
  );
}
