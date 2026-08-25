import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Badge, Button, Dropzone, Label } from "@fronteira-ui";
import {
  TRIBUTACAO_ANTECIPACAO_LABEL,
  usePreviewAntecipacaoMemoria,
  useSalvarAntecipacaoMemoria,
  type AntecipacaoPreviewResultado,
} from "../hooks/queries";
import { EmpresaPicker } from "../components/EmpresaPicker";
import { apiError } from "../lib/api";

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  sem_mudanca: "Sem mudança",
  conflito: "Conflito",
};

const STATUS_VARIANT: Record<string, "ok" | "neutral" | "warn"> = {
  novo: "ok",
  sem_mudanca: "neutral",
  conflito: "warn",
};

export default function AntecipacaoMemoriaImportar() {
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const preview = usePreviewAntecipacaoMemoria();
  const salvar = useSalvarAntecipacaoMemoria();
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [resultado, setResultado] = useState<AntecipacaoPreviewResultado | null>(null);
  const [salvo, setSalvo] = useState<{ total_criados: number; total_atualizados: number } | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!companyId) {
      setError("Selecione a empresa antes de enviar a planilha.");
      return;
    }
    setFileName(file.name);
    setError("");
    setSalvo(null);
    try {
      const data = await preview.mutateAsync({ file, companyId });
      setResultado(data);
    } catch (err) {
      setResultado(null);
      setError(apiError(err, "Não foi possível interpretar a planilha."));
    }
  }

  // Trocar de empresa invalida a prévia: "novo/sem mudança/conflito" foi
  // calculado contra a memória da empresa anterior.
  function handleEmpresaChange(id: number | null) {
    setCompanyId(id);
    setResultado(null);
    setSalvo(null);
    setFileName("");
  }

  async function handleConfirmar() {
    if (!resultado || !companyId) return;
    setError("");
    try {
      const rows = resultado.rows.map((r) => ({ ncm: r.ncm, descricao: r.descricao, tributacao: r.tributacao }));
      const res = await salvar.mutateAsync({ companyId, rows });
      setSalvo(res);
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar a memória."));
    }
  }

  return (
    <div className="stack gap-16">
      <div>
        <h1 className="page-title">Importar memória de Antecipação</h1>
        <p className="page-sub">Planilha com colunas NCM, Descrição e ICMS/Tributação</p>
      </div>

      <div className="card">
        <div className="card-body stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}

          <EmpresaPicker
            value={companyId}
            onChange={handleEmpresaChange}
            hint="A memória importada vale só para esta empresa."
          />

          <div className="field">
            <Label htmlFor="arquivo-xlsx">Arquivo XLSX</Label>
            <Dropzone
              id="arquivo-xlsx"
              accept=".xlsx"
              label="Arraste a planilha aqui"
              hint="Aceita .xlsx"
              disabled={!companyId}
              onFilesSelected={(files) => handleFile(files?.[0])}
            />
            <span className="field-hint">
              {!companyId
                ? "Selecione a empresa para habilitar o envio."
                : fileName
                  ? `Selecionado: ${fileName}`
                  : "Selecione a planilha de memória para pré-visualizar."}
            </span>
          </div>

          {preview.isPending && <div className="empty">Interpretando planilha…</div>}
        </div>
      </div>

      {resultado && (
        <div className="card">
          <div className="card-head">
            <h2 style={{ fontSize: 14 }}>Pré-visualização</h2>
            <div className="row gap-8">
              <Badge variant="ok">{resultado.total_novos} novo(s)</Badge>
              <Badge variant="neutral">{resultado.total_sem_mudanca} sem mudança</Badge>
              <Badge variant="warn">{resultado.total_conflitos} conflito(s)</Badge>
            </div>
          </div>

          <div className="card-body stack gap-16">
            {resultado.errors.length > 0 && (
              <div className="alert alert-danger">{resultado.errors.join(" ")}</div>
            )}

            {resultado.rows.length === 0 ? (
              <div className="empty">
                <strong>Nenhuma linha válida encontrada</strong>
                Confira as colunas da planilha.
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>NCM</th>
                    <th>Descrição</th>
                    <th>Tributação (planilha)</th>
                    <th>Tributação atual</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.rows.map((r) => (
                    <tr key={`${r.ncm}-${r.row_number}`}>
                      <td className="num">{r.row_number}</td>
                      <td className="num">{r.ncm}</td>
                      <td>{r.descricao}</td>
                      <td>{TRIBUTACAO_ANTECIPACAO_LABEL[r.tributacao] ?? r.tributacao}</td>
                      <td>
                        {r.tributacao_atual ? TRIBUTACAO_ANTECIPACAO_LABEL[r.tributacao_atual] ?? r.tributacao_atual : "—"}
                      </td>
                      <td>
                        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "space-between" }}>
            <Button variant="ghost" onClick={() => navigate(toAbs("antecipacao"))}>
              Cancelar
            </Button>
            {!salvo ? (
              <Button
                variant="primary"
                disabled={salvar.isPending || resultado.rows.length === 0}
                onClick={handleConfirmar}
              >
                {salvar.isPending ? "Salvando…" : `Confirmar importação (${resultado.rows.length} linha(s))`}
              </Button>
            ) : (
              <span className="muted">
                {salvo.total_criados} criada(s), {salvo.total_atualizados} atualizada(s) —{" "}
                <Button variant="primary" size="sm" onClick={() => navigate(toAbs("antecipacao"))}>
                  Ver memória
                </Button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
