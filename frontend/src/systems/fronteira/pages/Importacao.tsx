import { useMemo, useState } from "react";
import { Badge, Button, Checkbox, Dropzone, Label } from "@fronteira-ui";
import { EmpresaPicker } from "../components/EmpresaPicker";
import {
  downloadSmartImportTemplate,
  useSmartImportPreview,
  useSmartImportSave,
  type Empresa,
  type SmartImportRow,
} from "../hooks/queries";
import { apiError } from "../lib/api";
import { formatCNPJ } from "../lib/format";

const TRIB_LABEL: Record<string, string> = {
  normal: "Normal",
  st: "ST",
  rbc: "RBC",
  isento: "Isento",
};

const COL_HEADERS = ["SEGMENTO", "NCM", "DESCRIÇÃO", "ORIGINAL", "4%", "7%", "12%", "% INTERNA", "TRIBUTAÇÃO", "RBC"];

/** Importação (Smart Import) do Fronteira: planilha de MVA/tributação vira
 * memória (NCMRule) — sempre para uma empresa (não existe mais escopo
 * global). Fluxo em 3 passos: (1) empresa, (2) upload da planilha [+ XMLs
 * opcionais para o modo "importação inteligente"], (3) prévia editável por
 * seleção → confirma e grava. */
export default function Importacao() {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | undefined>();

  const [memoryFile, setMemoryFile] = useState<File | null>(null);
  const [useSmart, setUseSmart] = useState(false);
  const [xmlFiles, setXmlFiles] = useState<File[]>([]);

  const preview = useSmartImportPreview();
  const salvar = useSmartImportSave();
  const [error, setError] = useState("");
  const [rows, setRows] = useState<SmartImportRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [salvo, setSalvo] = useState<number | null>(null);

  async function handleGerarPrevia() {
    if (!memoryFile) return;
    setError("");
    setSalvo(null);
    try {
      const resultado = await preview.mutateAsync({ memoryFile, xmlFiles: useSmart ? xmlFiles : [] });
      setRows(resultado.rows);
      setSelected(new Set(resultado.rows.filter((r) => r.selected).map((r) => r.row_id)));
      if (resultado.errors.length > 0) setError(resultado.errors.join(" "));
    } catch (err) {
      setRows(null);
      setError(apiError(err, "Não foi possível interpretar a planilha."));
    }
  }

  function toggleRow(rowId: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(rowId) ? n.delete(rowId) : n.add(rowId);
      return n;
    });
  }

  const allSelected = rows != null && rows.length > 0 && rows.every((r) => selected.has(r.row_id));
  function toggleAll(check: boolean) {
    if (!rows) return;
    setSelected(check ? new Set(rows.map((r) => r.row_id)) : new Set());
  }

  async function handleSalvar() {
    if (!rows || companyId == null) return;
    setError("");
    try {
      const selecionadas = rows.filter((r) => selected.has(r.row_id));
      const res = await salvar.mutateAsync({
        companyId,
        rows: selecionadas.map((r) => ({
          row_id: r.row_id,
          ncm: r.ncm,
          descricao: r.descricao,
          segmento: r.segmento,
          tributacao: r.tributacao,
          mva_original: r.mva_original,
          mva_4: r.mva_4,
          mva_7: r.mva_7,
          mva_12: r.mva_12,
          aliquota_interna: r.aliquota_interna,
          rbc: r.rbc,
        })),
      });
      setSalvo(res.saved);
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar a memória."));
    }
  }

  function reiniciar() {
    setMemoryFile(null);
    setXmlFiles([]);
    setRows(null);
    setSelected(new Set());
    setSalvo(null);
    setError("");
  }

  const totals = useMemo(() => {
    if (!rows) return null;
    return {
      pendentes: rows.filter((r) => !r.descricao).length,
      conflitos: rows.filter((r) => r.has_conflict).length,
    };
  }, [rows]);

  return (
    <div className="stack gap-16">
      <div>
        <h1 className="page-title">Importação</h1>
        <p className="page-sub">Importação via planilha completa.</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 style={{ fontSize: 14 }}>1. Empresa da importação</h2>
          {companyId && <Badge variant="ok">Empresa selecionada</Badge>}
        </div>
        <div className="card-body stack gap-16">
          <EmpresaPicker
            label="Empresa"
            value={companyId}
            onChange={(id, e) => {
              setCompanyId(id);
              setEmpresa(e);
              reiniciar();
            }}
            hint="A memória (regras NCM/MVA) é sempre por empresa. Não achou? Crie em “+ Nova empresa”."
          />
        </div>
      </div>

      {companyId && (
        <div className="card">
          <div className="card-head">
            <h2 style={{ fontSize: 14 }}>2. Planilha de memória</h2>
            <span className="muted" style={{ fontSize: 13 }}>
              Importando para <strong>{empresa?.nome}</strong>
              {empresa && <span className="num"> ({formatCNPJ(empresa.cnpj)})</span>}
            </span>
          </div>
          <div className="card-body stack gap-16">
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="stack gap-8" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
              <strong style={{ fontSize: 13 }}>Formato obrigatório da planilha</strong>
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                A planilha precisa ter exatamente os cabeçalhos abaixo. Se estiver fora do padrão, o sistema indicará
                qual coluna está ausente.
              </p>
              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                {COL_HEADERS.map((h) => (
                  <Badge key={h} variant="neutral">
                    {h}
                  </Badge>
                ))}
              </div>
              <div>
                <Button variant="ghost" size="sm" onClick={() => downloadSmartImportTemplate()}>
                  ↓ Baixar modelo .xlsx
                </Button>
              </div>
            </div>

            <div className="field">
              <Label htmlFor="planilha-memoria">Planilha completa</Label>
              <Dropzone
                id="planilha-memoria"
                accept=".xlsx"
                label="Arraste a planilha aqui"
                hint="Aceita .xlsx"
                onFilesSelected={(files) => setMemoryFile(files?.[0] ?? null)}
              />
              <span className="field-hint">
                {memoryFile
                  ? `Selecionada: ${memoryFile.name}`
                  : "Colunas esperadas: SEGMENTO, NCM, DESCRIÇÃO, ORIGINAL, 4%, 7%, 12%, % INTERNA, TRIBUTAÇÃO e RBC."}
              </span>
            </div>

            <Checkbox
              checked={useSmart}
              onCheckedChange={(c) => setUseSmart(!!c)}
              label="Usar importação inteligente (planilha + XMLs)"
            />

            {useSmart && (
              <div className="field">
                <Label htmlFor="xmls-memoria">XMLs das notas (opcional)</Label>
                <Dropzone
                  id="xmls-memoria"
                  accept=".xml"
                  multiple
                  label="Arraste os XMLs aqui"
                  hint="Só entram na prévia os NCMs que aparecem nestas notas"
                  onFilesSelected={(files) => setXmlFiles(files ? Array.from(files) : [])}
                />
                <span className="field-hint">
                  {xmlFiles.length > 0 ? `${xmlFiles.length} arquivo(s) selecionado(s)` : "Nenhum XML selecionado."}
                </span>
              </div>
            )}

            {preview.isPending && <div className="empty">Interpretando planilha…</div>}
          </div>

          <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "flex-end" }}>
            <Button variant="primary" disabled={!memoryFile || preview.isPending} onClick={handleGerarPrevia}>
              → Gerar prévia
            </Button>
          </div>
        </div>
      )}

      {rows && (
        <div className="card">
          <div className="card-head" style={{ flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 14 }}>3. Prévia</h2>
            <div className="row gap-8">
              <Badge variant="neutral">{rows.length} linha(s)</Badge>
              <Badge variant="ok">{selected.size} selecionada(s)</Badge>
              {totals && totals.pendentes > 0 && <Badge variant="warn">{totals.pendentes} pendente(s)</Badge>}
              {totals && totals.conflitos > 0 && <Badge variant="err">{totals.conflitos} conflito(s)</Badge>}
            </div>
          </div>

          <div className="card-body stack gap-16">
            {rows.length === 0 ? (
              <div className="empty">
                <strong>Nenhuma linha válida encontrada</strong>
                Confira as colunas da planilha (ou os XMLs, se usou a importação inteligente).
              </div>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}>
                        <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                      </th>
                      <th>NCM</th>
                      <th>Descrição</th>
                      <th>Tributação</th>
                      <th className="right">Original</th>
                      <th className="right">4%</th>
                      <th className="right">7%</th>
                      <th className="right">12%</th>
                      <th className="right">% Interna</th>
                      <th className="right">RBC</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.row_id}>
                        <td>
                          <Checkbox checked={selected.has(r.row_id)} onCheckedChange={() => toggleRow(r.row_id)} />
                        </td>
                        <td className="num">{r.ncm}</td>
                        <td>{r.descricao || <span className="muted">—</span>}</td>
                        <td>{TRIB_LABEL[r.tributacao] ?? r.tributacao}</td>
                        <td className="right num">{r.mva_original}</td>
                        <td className="right num">{r.mva_4}</td>
                        <td className="right num">{r.mva_7}</td>
                        <td className="right num">{r.mva_12}</td>
                        <td className="right num">{r.aliquota_interna}</td>
                        <td className="right num">{r.rbc}</td>
                        <td>
                          <div className="row gap-4" style={{ flexWrap: "wrap" }}>
                            {!r.descricao && <Badge variant="warn">Sem descrição</Badge>}
                            {r.has_conflict && <Badge variant="err">Conflito</Badge>}
                            {r.xml_match_count > 0 && <Badge variant="neutral">{r.xml_match_count}x na nota</Badge>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "space-between" }}>
            <Button variant="ghost" onClick={reiniciar}>
              ← Recomeçar
            </Button>
            {salvo == null ? (
              <Button variant="primary" disabled={salvar.isPending || selected.size === 0} onClick={handleSalvar}>
                {salvar.isPending ? "Salvando…" : `Salvar ${selected.size} selecionada(s)`}
              </Button>
            ) : (
              <span className="muted">{salvo} regra(s) gravada(s) com sucesso.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
