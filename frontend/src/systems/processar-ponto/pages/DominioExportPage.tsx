import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { getUploadResult } from "@ponto/api/client";
import type { UploadResult } from "@ponto/types/point";
import { ClienteSelect } from "@ponto/components/dominio/ClienteSelect";
import { DominioExportPreview } from "@ponto/components/dominio/DominioExportPreview";
import { buildPayrollEventsForAll } from "@ponto/lib/payrollEvents";
import { DominioApiError, dominioExportsApi, type DominioExport } from "@ponto/lib/dominioApi";

function primeiroDiaDoMesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function DominioExportPage() {
  const { uploadId } = useParams<{ uploadId: string }>();
  const [data, setData] = useState<UploadResult | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [competence, setCompetence] = useState(primeiroDiaDoMesAtual());
  const [exportData, setExportData] = useState<DominioExport | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (uploadId) getUploadResult(uploadId).then(setData).catch(console.error);
  }, [uploadId]);

  const gerarPreview = async () => {
    if (!data || !clienteId) return;
    setErro(null);
    setGerando(true);
    try {
      let atual = exportData;
      if (!atual) {
        atual = await dominioExportsApi.create(clienteId, competence);
      }
      const eventos = buildPayrollEventsForAll(data.employees, competence);
      const resultado = await dominioExportsApi.preview(atual.id, competence, eventos);
      setExportData(resultado);
    } catch (e) {
      setErro(e instanceof DominioApiError ? e.message : "Erro ao gerar a prévia.");
    } finally {
      setGerando(false);
    }
  };

  const enviar = async () => {
    if (!exportData) return;
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await dominioExportsApi.send(exportData.id);
      setExportData(resultado);
    } catch (e) {
      setErro(e instanceof DominioApiError ? e.message : "Erro ao enviar para o Domínio.");
    } finally {
      setEnviando(false);
    }
  };

  const podeEnviar = exportData?.status === "READY";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link to=".." className="flex items-center gap-2 text-secondary hover:underline mb-2">
          <ArrowLeft size={20} /> Voltar para o resultado
        </Link>
        <h2 className="text-3xl font-bold text-textPrimary">Enviar ao Domínio</h2>
        <p className="text-textSecondary">Arquivo: <span className="font-medium text-textPrimary">{data?.file_name}</span></p>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[240px]">
          <ClienteSelect value={clienteId} onChange={setClienteId} />
        </div>
        <div>
          <label className="block text-xs font-bold text-textSecondary uppercase mb-1.5">Competência</label>
          <input
            type="month"
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary"
            value={competence.slice(0, 7)}
            onChange={(e) => setCompetence(`${e.target.value}-01`)}
          />
        </div>
        <button
          onClick={gerarPreview}
          disabled={!clienteId || !data || gerando}
          className="flex items-center gap-2 h-10 px-4 rounded-lg bg-secondary text-black font-bold text-sm hover:bg-secondaryHover disabled:opacity-50"
        >
          {gerando && <Loader2 size={16} className="animate-spin" />}
          {exportData ? "Atualizar prévia" : "Gerar prévia"}
        </button>
      </div>

      {erro && <div className="text-sm text-error bg-error/10 border border-error/30 rounded-lg px-4 py-3">{erro}</div>}

      {exportData && (
        <>
          <DominioExportPreview clienteId={clienteId} exportData={exportData} onRefreshPreview={gerarPreview} />

          <div className="flex justify-end">
            <button
              onClick={enviar}
              disabled={!podeEnviar || enviando}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-background font-bold text-sm disabled:opacity-50"
            >
              {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Enviar para o Domínio
            </button>
          </div>
        </>
      )}
    </div>
  );
}
