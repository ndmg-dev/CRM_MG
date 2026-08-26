import { useState } from "react";
import { Dropzone, Label, Spinner } from "@fronteira-ui";
import { useWizardUpload, type WizardUploadResultado } from "../../hooks/queries";
import { useLoader } from "../LoaderOverlay";
import { apiError } from "../../lib/api";

export function WizardStepUpload({ onUploaded }: { onUploaded: (resultado: WizardUploadResultado) => void }) {
  const upload = useWizardUpload();
  const loader = useLoader();
  const [error, setError] = useState("");
  const [fileNames, setFileNames] = useState<string[]>([]);

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setFileNames(files.map((f) => f.name));
    setError("");
    try {
      const resultado = await loader.run(
        `Analisando ${files.length} arquivo(s)…`,
        () => upload.mutateAsync(files),
      );
      if (resultado.total_notas === 0) {
        setError(
          resultado.errors.length > 0
            ? resultado.errors.join("; ")
            : "Nenhuma nota fiscal encontrada nos arquivos enviados.",
        );
        return;
      }
      onUploaded(resultado);
    } catch (err) {
      setError(apiError(err, "Não foi possível processar os arquivos."));
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2 style={{ fontSize: 14 }}>1. Upload das NF-e</h2>
      </div>
      <div className="card-body stack gap-16">
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="field">
          <Label htmlFor="wizard-upload-files">Arquivos XML e/ou ZIP das notas fiscais</Label>
          <Dropzone
            id="wizard-upload-files"
            accept=".xml,.zip"
            multiple
            label="Arraste XMLs ou ZIPs aqui"
            hint="Aceita .xml e .zip — cada ZIP pode conter várias NF-e"
            onFilesSelected={handleFiles}
          />
          <span className="field-hint">
            {fileNames.length > 0
              ? `Selecionado(s): ${fileNames.join(", ")}`
              : "Selecione um ou mais XML e/ou ZIP (cada ZIP pode conter várias NF-e) para começar."}
          </span>
        </div>

        {upload.isPending && (
          <div className="empty row gap-8" style={{ justifyContent: "center", alignItems: "center" }}>
            <Spinner size="md" />
            Processando arquivos…
          </div>
        )}
      </div>
    </div>
  );
}
