import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Button, Dropzone, Input, Label } from "@fronteira-ui";
import { EmpresaPicker } from "../components/EmpresaPicker";
import { useCriarComparacao } from "../hooks/queries";
import { apiError } from "../lib/api";

export default function ComparacaoCriar() {
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const criar = useCriarComparacao();

  const [file, setFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [competenciaMes, setCompetenciaMes] = useState("");
  const [tolerancia, setTolerancia] = useState("0");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Selecione o arquivo .xls do extrato SEFAZ.");
      return;
    }
    if (!competenciaMes) {
      setError("Informe a competência.");
      return;
    }
    try {
      const result = await criar.mutateAsync({
        file,
        companyId,
        competencia: `${competenciaMes}-01`,
        tolerancia: tolerancia || "0",
      });
      navigate(toAbs(`comparacao/${result.id}`));
    } catch (err) {
      setError(apiError(err, "Não foi possível processar a comparação."));
    }
  }

  return (
    <div className="stack gap-16" style={{ maxWidth: 560 }}>
      <div>
        <h1 className="page-title">Nova comparação SEFAZ</h1>
        <p className="page-sub">Envie o extrato .xls; cruzamos com as notas de (empresa, competência)</p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="card-body stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="field">
            <Label htmlFor="extrato">Extrato SEFAZ (.xls)</Label>
            <Dropzone
              id="extrato"
              accept=".xls,.xlsx"
              label="Arraste o extrato aqui"
              hint="Aceita .xls e .xlsx"
              onFilesSelected={(files) => setFile(files?.[0] ?? null)}
            />
            <span className="field-hint">
              {file ? file.name : "Arquivo de ICMS Antecipado exportado da SEFAZ."}
            </span>
          </div>

          <div className="grid-2">
            <EmpresaPicker
              label="Empresa (opcional)"
              value={companyId}
              onChange={(id) => setCompanyId(id)}
              allowCreate={false}
              emptyOptionLabel="Todas as empresas"
            />
            <div className="field">
              <Label htmlFor="competencia">Competência</Label>
              <Input
                id="competencia"
                type="month"
                value={competenciaMes}
                onChange={(e) => setCompetenciaMes(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field" style={{ maxWidth: 220 }}>
            <Label htmlFor="tolerancia">Tolerância (R$)</Label>
            <Input
              id="tolerancia"
              type="number"
              step="0.01"
              min="0"
              className="num"
              value={tolerancia}
              onChange={(e) => setTolerancia(e.target.value)}
            />
            <span className="field-hint">Diferença de ICMS ignorada como "dentro da tolerância".</span>
          </div>
        </div>

        <div
          className="card-head"
          style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "flex-end" }}
        >
          <Button type="button" variant="ghost" onClick={() => navigate(toAbs("comparacao"))}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={criar.isPending}>
            {criar.isPending ? "Comparando…" : "Comparar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
