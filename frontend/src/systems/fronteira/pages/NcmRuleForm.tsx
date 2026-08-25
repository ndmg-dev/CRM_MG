import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Button, Checkbox, Input, Label, Select } from "@fronteira-ui";
import {
  useChoices,
  useNcmRule,
  useSaveNcmRule,
  type NcmRuleInput,
} from "../hooks/queries";
import { EmpresaPicker } from "../components/EmpresaPicker";
import { apiError } from "../lib/api";
import { onlyDigits } from "../lib/format";

// Estado local do formulário: `company_id` pode estar "não escolhido" (null)
// enquanto edita, mas é obrigatório para salvar (não existe mais regra global).
type NcmRuleForm = Omit<NcmRuleInput, "company_id"> & { company_id: number | null };

const EMPTY: NcmRuleForm = {
  company_id: null,
  ncm: "",
  descricao: "",
  segmento: "",
  tributacao: "normal",
  mva_original: "0",
  mva_4: "0",
  mva_7: "0",
  mva_12: "0",
  aliquota_interna: "0.2050",
  rbc: "0.8000",
  ativo: true,
};

export default function NcmRuleForm() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  // A listagem passa a empresa já escolhida (`?company_id=`) para não obrigar
  // a escolher de novo o que acabou de ser escolhido na tela anterior.
  const [searchParams] = useSearchParams();
  const companyIdDaListagem = Number(searchParams.get("company_id")) || null;

  const { data: choices } = useChoices();
  const { data: existing } = useNcmRule(editId);
  const save = useSaveNcmRule(editId);

  const [form, setForm] = useState<NcmRuleForm>(() =>
    editId ? EMPTY : { ...EMPTY, company_id: companyIdDaListagem },
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (existing) {
      const { id: _id, ...rest } = existing;
      void _id;
      setForm(rest);
    }
  }, [existing]);

  function set<K extends keyof NcmRuleForm>(key: K, value: NcmRuleForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (form.company_id == null) {
      setError("Selecione a empresa da regra.");
      return;
    }
    if (onlyDigits(form.ncm).length !== 8) {
      setError("NCM deve ter 8 dígitos.");
      return;
    }
    try {
      await save.mutateAsync({ ...form, company_id: form.company_id, ncm: onlyDigits(form.ncm) });
      navigate(toAbs("ncm-rules"));
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar."));
    }
  }

  return (
    <div className="stack gap-16" style={{ maxWidth: 640 }}>
      <div>
        <h1 className="page-title">{editId ? "Editar regra NCM" : "Nova regra NCM"}</h1>
        <p className="page-sub">Tributação e margem de valor agregado por NCM</p>
      </div>

      <form onSubmit={submit} className="card">
        <div className="card-body stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}

          <EmpresaPicker
            label="Empresa"
            value={form.company_id}
            onChange={(companyId) => set("company_id", companyId)}
            hint="A regra é sempre de uma empresa. Não achou? Crie em “+ Nova empresa”."
          />

          <div className="grid-2">
            <div className="field">
              <Label htmlFor="ncm">NCM</Label>
              <Input
                id="ncm"
                className="num"
                value={form.ncm}
                onChange={(e) => set("ncm", onlyDigits(e.target.value))}
                placeholder="00000000"
                inputMode="numeric"
                maxLength={8}
                required
              />
              <span className="field-hint">8 dígitos, sem pontuação.</span>
            </div>
            <SelectField
              label="Tributação"
              value={form.tributacao}
              onChange={(v) => set("tributacao", v)}
              options={choices?.item_tributacao}
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <Label htmlFor="descricao">Descrição</Label>
              <Input id="descricao" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
            </div>
            <div className="field">
              <Label htmlFor="segmento">Segmento</Label>
              <Input id="segmento" value={form.segmento} onChange={(e) => set("segmento", e.target.value)} />
            </div>
          </div>

          <div className="frontier-rule" />

          <div className="grid-2">
            <NumField label="MVA original (0–1)" value={form.mva_original} onChange={(v) => set("mva_original", v)} />
            <NumField label="Alíquota interna (0–1)" value={form.aliquota_interna} onChange={(v) => set("aliquota_interna", v)} />
          </div>
          <div className="grid-3">
            <NumField label="MVA 4%" value={form.mva_4} onChange={(v) => set("mva_4", v)} />
            <NumField label="MVA 7%" value={form.mva_7} onChange={(v) => set("mva_7", v)} />
            <NumField label="MVA 12%" value={form.mva_12} onChange={(v) => set("mva_12", v)} />
          </div>
          <div className="grid-2">
            <NumField label="RBC (0–1)" value={form.rbc} onChange={(v) => set("rbc", v)} />
            <div className="field">
              <Label>Situação</Label>
              <div style={{ paddingTop: 8 }}>
                <Checkbox
                  id="ativo"
                  checked={form.ativo}
                  onCheckedChange={(checked) => set("ativo", checked)}
                  label="Regra ativa"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={() => navigate(toAbs("ncm-rules"))}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; label: string }[];
}) {
  return (
    <div className="field">
      <Label>{label}</Label>
      <Select aria-label={label} value={value} onValueChange={onChange} options={options ?? []} />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <Label>{label}</Label>
      <Input className="num" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
