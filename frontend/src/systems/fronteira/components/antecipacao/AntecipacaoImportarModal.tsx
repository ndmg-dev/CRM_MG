import { useEffect, useState } from "react";
import { Badge, Button, Dropzone, Modal } from "@fronteira-ui";
import {
  TRIBUTACAO_ANTECIPACAO_LABEL,
  downloadModeloMemoriaAntecipacao,
  usePreviewAntecipacaoMemoria,
  useSalvarAntecipacaoMemoria,
  type AntecipacaoPreviewResultado,
} from "../../hooks/queries";
import { apiError } from "../../lib/api";

const STATUS_LABEL: Record<string, string> = { novo: "Novo", sem_mudanca: "Sem mudança", conflito: "Conflito" };
const STATUS_VARIANT: Record<string, "ok" | "neutral" | "warn"> = { novo: "ok", sem_mudanca: "neutral", conflito: "warn" };

/** Importar planilha de memória num modal (como no v7): dropzone + "Baixar
 * Modelo" dentro do próprio modal (o modelo só aparece aqui, ao importar) +
 * pré-visualização do diff antes de confirmar.
 *
 * `companyId` é obrigatório: a memória é por empresa, e tanto o diff da
 * prévia quanto a gravação precisam saber contra qual catálogo comparar. Quem
 * abre o modal escolhe a empresa antes. */
export function AntecipacaoImportarModal({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: number;
}) {
  const preview = usePreviewAntecipacaoMemoria();
  const salvar = useSalvarAntecipacaoMemoria();
  const [file, setFile] = useState<File | null>(null);
  const [resultado, setResultado] = useState<AntecipacaoPreviewResultado | null>(null);
  const [salvo, setSalvo] = useState<{ total_criados: number; total_atualizados: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFile(null);
      setResultado(null);
      setSalvo(null);
      setError("");
    }
  }, [open]);

  async function handlePreview() {
    if (!file) return;
    setError("");
    try {
      setResultado(await preview.mutateAsync({ file, companyId }));
    } catch (err) {
      setResultado(null);
      setError(apiError(err, "Não foi possível interpretar a planilha."));
    }
  }

  async function handleConfirmar() {
    if (!resultado) return;
    setError("");
    try {
      const rows = resultado.rows.map((r) => ({ ncm: r.ncm, descricao: r.descricao, tributacao: r.tributacao }));
      setSalvo(await salvar.mutateAsync({ companyId, rows }));
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar a memória."));
    }
  }

  const actions = salvo ? (
    <Button variant="primary" onClick={() => onOpenChange(false)}>Fechar</Button>
  ) : resultado ? (
    <>
      <Button variant="ghost" onClick={() => setResultado(null)}>← Voltar</Button>
      <Button variant="primary" disabled={salvar.isPending || resultado.rows.length === 0} onClick={handleConfirmar}>
        {salvar.isPending ? "Salvando…" : `Confirmar importação (${resultado.rows.length})`}
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={() => downloadModeloMemoriaAntecipacao()}>↓ Baixar Modelo</Button>
      <Button variant="primary" disabled={!file || preview.isPending} onClick={handlePreview}>
        {preview.isPending ? "Lendo…" : "Pré-visualizar →"}
      </Button>
    </>
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Importar planilha" actions={actions}>
      <div className="stack gap-16">
        {error && <div className="alert alert-danger">{error}</div>}

        {salvo ? (
          <div className="alert alert-ok">
            {salvo.total_criados} criada(s), {salvo.total_atualizados} atualizada(s) com sucesso.
          </div>
        ) : resultado ? (
          <>
            <div className="row gap-8">
              <Badge variant="ok">{resultado.total_novos} novo(s)</Badge>
              <Badge variant="neutral">{resultado.total_sem_mudanca} sem mudança</Badge>
              <Badge variant="warn">{resultado.total_conflitos} conflito(s)</Badge>
            </div>
            {resultado.errors.length > 0 && <div className="alert alert-danger">{resultado.errors.join(" ")}</div>}
            {resultado.rows.length === 0 ? (
              <div className="empty"><strong>Nenhuma linha válida</strong>Confira as colunas da planilha.</div>
            ) : (
              <div className="table-scroll" style={{ maxHeight: 340 }}>
                <table className="table">
                  <thead>
                    <tr><th>NCM</th><th>Descrição</th><th>Tributação</th><th>Atual</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {resultado.rows.map((r) => (
                      <tr key={`${r.ncm}-${r.row_number}`}>
                        <td className="num">{r.ncm}</td>
                        <td>{r.descricao}</td>
                        <td>{TRIBUTACAO_ANTECIPACAO_LABEL[r.tributacao] ?? r.tributacao}</td>
                        <td>{r.tributacao_atual ? TRIBUTACAO_ANTECIPACAO_LABEL[r.tributacao_atual] ?? r.tributacao_atual : "—"}</td>
                        <td><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <Dropzone
              id="import-memoria-modal"
              accept=".xlsx"
              label="Arraste a planilha aqui"
              hint="ou clique para selecionar · .xlsx"
              onFilesSelected={(files) => setFile(files?.[0] ?? null)}
            />
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <span className="muted" style={{ fontSize: 12.5 }}>
                Formato: <strong>NCM</strong> | Descrição | ICMS
              </span>
              {file && <span className="field-hint">· {file.name}</span>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
