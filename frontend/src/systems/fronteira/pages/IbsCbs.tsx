import { Fragment, useMemo, useState } from "react";
import { Badge, Button, Dropzone, Label } from "@fronteira-ui";
import { useExportarIBSCBS, useVerificarIBSCBS, type IBSCBSNota } from "../hooks/queries";
import { apiError } from "../lib/api";
import { formatCNPJ } from "../lib/format";

type Filtro = "todos" | "com" | "sem";

/** Utilitário: verificação de IBS/CBS (Reforma Tributária) em NF-e.
 * Ferramenta de leitura pontual — sobe XML(s)/ZIP(s), o backend responde se
 * o grupo `<IBSCBS>` já vem preenchido em cada nota, sem gravar nada. O
 * resultado fica só em memória (React state) enquanto a tela está aberta —
 * "Limpar análise" apenas descarta o state local. */
export default function IbsCbs() {
  const verificar = useVerificarIBSCBS();
  const exportar = useExportarIBSCBS();
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof verificar.mutateAsync>> | null>(null);
  // Guardado pra reenviar no "Exportar Excel" — a verificação não persiste
  // nada no servidor, então não há um resultado salvo pra reexportar sem os
  // arquivos originais (ver README).
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [abertas, setAbertas] = useState<Set<number>>(new Set());

  async function handleFiles(files: FileList | null) {
    const lista = Array.from(files ?? []);
    if (lista.length === 0) return;
    setError("");
    try {
      const data = await verificar.mutateAsync(lista);
      setResultado(data);
      setArquivos(lista);
      setFiltro("todos");
      setAbertas(new Set());
      if (data.errors.length > 0) setError(data.errors.join(" "));
    } catch (err) {
      setResultado(null);
      setError(apiError(err, "Não foi possível verificar os arquivos."));
    }
  }

  async function handleExportar() {
    setError("");
    try {
      await exportar.mutateAsync(arquivos);
    } catch (err) {
      setError(apiError(err, "Não foi possível exportar o Excel."));
    }
  }

  function limpar() {
    setResultado(null);
    setArquivos([]);
    setError("");
    setFiltro("todos");
    setAbertas(new Set());
  }

  function toggle(i: number) {
    setAbertas((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }

  const visiveis: { nota: IBSCBSNota; idx: number }[] = useMemo(() => {
    const todas = (resultado?.resultados ?? []).map((nota, idx) => ({ nota, idx }));
    if (filtro === "com") return todas.filter((r) => r.nota.tem_ibscbs);
    if (filtro === "sem") return todas.filter((r) => !r.nota.tem_ibscbs);
    return todas;
  }, [resultado, filtro]);

  return (
    <div className="stack gap-16">
      <div className="row gap-8" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Verificação de IBS/CBS</h1>
          <p className="page-sub">
            Confira se as notas já trazem o grupo <strong>IBSCBS</strong> da Reforma Tributária. Envie XMLs soltos, um
            ZIP ou vários arquivos.
          </p>
        </div>
        {resultado && (
          <div className="row gap-8">
            <Button variant="primary" disabled={exportar.isPending} onClick={handleExportar}>
              ↓ Exportar Excel
            </Button>
            <Button variant="ghost" onClick={limpar}>
              Limpar análise
            </Button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-body stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="field">
            <Label htmlFor="ibscbs-files">Arquivos XML e/ou ZIP</Label>
            <Dropzone
              id="ibscbs-files"
              accept=".xml,.zip"
              multiple
              label="Arraste XMLs ou ZIPs aqui"
              hint="Aceita múltiplos .xml e .zip"
              onFilesSelected={handleFiles}
            />
          </div>

          {verificar.isPending && <div className="empty">Verificando IBS/CBS nas notas…</div>}
        </div>
      </div>

      {resultado && (
        <div className="card">
          <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="stack" style={{ gap: 2 }}>
              <h2 style={{ fontSize: 14 }}>Resultado da análise</h2>
              <span className="page-sub">
                {resultado.total_notas} nota(s) · {resultado.total_com} com IBS/CBS · {resultado.total_sem} sem
              </span>
            </div>
            <div className="chip-group">
              <button className={`chip ${filtro === "todos" ? "active" : ""}`} onClick={() => setFiltro("todos")}>
                Todos <span className="count">{resultado.total_notas}</span>
              </button>
              <button className={`chip ${filtro === "com" ? "active" : ""}`} onClick={() => setFiltro("com")}>
                Com IBS/CBS <span className="count">{resultado.total_com}</span>
              </button>
              <button className={`chip ${filtro === "sem" ? "active" : ""}`} onClick={() => setFiltro("sem")}>
                Não contém <span className="count">{resultado.total_sem}</span>
              </button>
            </div>
          </div>

          <div className="card-body stack gap-12">
            {visiveis.length === 0 ? (
              <div className="empty">Nenhuma nota para o filtro selecionado.</div>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nº Nota</th>
                      <th>UF</th>
                      <th>Remetente</th>
                      <th>Status</th>
                      <th className="right">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map(({ nota, idx }) => {
                      const aberta = abertas.has(idx);
                      return (
                        <Fragment key={idx}>
                          <tr>
                            <td className="num">
                              {nota.numero || "—"}
                              {nota.serie && <span className="muted" style={{ fontSize: 11 }}> /{nota.serie}</span>}
                            </td>
                            <td className="num">{nota.emitente_uf || "—"}</td>
                            <td>
                              <div className="stack" style={{ gap: 2 }}>
                                <span>{nota.emitente_nome || "—"}</span>
                                {nota.emitente_cnpj && (
                                  <span className="muted num" style={{ fontSize: 11.5 }}>{formatCNPJ(nota.emitente_cnpj)}</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <Badge variant={nota.tem_ibscbs ? "ok" : "neutral"}>
                                {nota.tem_ibscbs ? "Tem IBS/CBS" : "Não tem"}
                              </Badge>
                            </td>
                            <td className="right">
                              <Button variant="ghost" size="sm" disabled={!nota.tem_ibscbs} onClick={() => toggle(idx)}>
                                {aberta ? "Fechar" : "Detalhes"}
                              </Button>
                            </td>
                          </tr>
                          {aberta && nota.tem_ibscbs && (
                            <tr>
                              <td colSpan={5} style={{ padding: 0 }}>
                                {/* .detail-panel tem max-width:1100px (bom pro painel do wizard, ao
                                    lado de outras colunas) — aqui o <td> já ocupa a tela inteira
                                    (colSpan=5), então essa tela usa o espaço todo. */}
                                <div className="detail-panel" style={{ gridTemplateColumns: "1fr", maxWidth: "none" }}>
                                  <div className="detail-section full">
                                    <h4>Nota</h4>
                                    <div className="detail-line">
                                      <span className="k">Chave</span>
                                      <span className="v">{nota.chave_nfe || "—"}</span>
                                    </div>
                                    <div className="detail-line">
                                      <span className="k">Destinatário</span>
                                      <span className="v">
                                        {nota.destinatario_nome || "—"} ({nota.destinatario_uf || "—"})
                                      </span>
                                    </div>
                                  </div>

                                  {nota.itens.length > 0 && (
                                    <div className="detail-section full">
                                      <h4>Itens com IBSCBS</h4>
                                      <div className="table-scroll">
                                        <table className="table" style={{ fontSize: 12.5 }}>
                                          <thead>
                                            <tr>
                                              <th>Item</th>
                                              <th>Descrição</th>
                                              <th>CST</th>
                                              <th>cClassTrib</th>
                                              <th className="right">vBC</th>
                                              <th className="right">pIBSUF</th>
                                              <th className="right">vIBSUF</th>
                                              <th className="right">pIBSMun</th>
                                              <th className="right">vIBSMun</th>
                                              <th className="right">vIBS</th>
                                              <th className="right">pCBS</th>
                                              <th className="right">vCBS</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {nota.itens.map((it) => (
                                              <tr key={it.numero_item}>
                                                <td className="num">{it.numero_item}</td>
                                                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                  {it.descricao || "—"}
                                                </td>
                                                <td className="num">{it.cst || "—"}</td>
                                                <td className="num">{it.cclasstrib || "—"}</td>
                                                <td className="right num">{it.v_bc || "—"}</td>
                                                <td className="right num">{it.p_ibs_uf || "—"}</td>
                                                <td className="right num">{it.v_ibs_uf || "—"}</td>
                                                <td className="right num">{it.p_ibs_mun || "—"}</td>
                                                <td className="right num">{it.v_ibs_mun || "—"}</td>
                                                <td className="right num">{it.v_ibs || "—"}</td>
                                                <td className="right num">{it.p_cbs || "—"}</td>
                                                <td className="right num">{it.v_cbs || "—"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {nota.totais && (
                                    <div className="detail-section full">
                                      <h4>Totais IBSCBS</h4>
                                      <div className="row gap-16" style={{ flexWrap: "wrap", fontSize: 13 }}>
                                        <span>vBCIBSCBS <strong className="num">{nota.totais.v_bc_ibscbs || "—"}</strong></span>
                                        <span>vIBS <strong className="num">{nota.totais.v_ibs || "—"}</strong></span>
                                        <span>vCBS <strong className="num">{nota.totais.v_cbs || "—"}</strong></span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
