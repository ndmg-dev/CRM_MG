import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Button, Checkbox, Input, Label, Select } from "@fronteira-ui";
import { useChoices, useEmpresa, useSaveEmpresa, type EmpresaInput } from "../hooks/queries";
import { apiError } from "../lib/api";
import { formatCNPJ, onlyDigits } from "../lib/format";
import { PerfilInfoIcon } from "../components/PerfilInfoIcon";

const EMPTY: EmpresaInput = {
  nome: "",
  cnpj: "",
  tributacao: "simples_irregular",
  porte: "epp",
  perfil: "varejista",
  ativo: true,
};

export default function EmpresaForm() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();

  const { data: choices } = useChoices();
  const { data: existing } = useEmpresa(editId);
  const save = useSaveEmpresa(editId);

  const [form, setForm] = useState<EmpresaInput>(EMPTY);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existing) {
      const { id: _id, criado_em, atualizado_em, ...rest } = existing;
      void _id; void criado_em; void atualizado_em;
      setForm(rest);
    }
  }, [existing]);

  function set<K extends keyof EmpresaInput>(key: K, value: EmpresaInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (onlyDigits(form.cnpj).length !== 14) {
      setError("CNPJ deve ter 14 dígitos.");
      return;
    }
    try {
      await save.mutateAsync({ ...form, cnpj: onlyDigits(form.cnpj) });
      navigate(toAbs("empresas"));
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar."));
    }
  }

  return (
    <div className="stack gap-16" style={{ maxWidth: 640 }}>
      <div>
        <h1 className="page-title">{editId ? "Editar empresa" : "Nova empresa"}</h1>
        <p className="page-sub">Dados cadastrais e regime fiscal</p>
      </div>

      <form onSubmit={submit} className="card">
        <div className="card-body stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="field">
            <Label htmlFor="nome">Razão social</Label>
            <Input id="nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} required />
          </div>

          <div className="field">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              className="num"
              value={form.cnpj.length === 14 ? formatCNPJ(form.cnpj) : form.cnpj}
              onChange={(e) => set("cnpj", onlyDigits(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              maxLength={18}
              required
            />
          </div>

          <div className="grid-2">
            <SelectField
              label="Tributação"
              value={form.tributacao}
              onChange={(v) => set("tributacao", v)}
              options={choices?.company_tributacao}
            />
            <SelectField
              label="Perfil"
              value={form.perfil}
              onChange={(v) => set("perfil", v)}
              options={choices?.company_perfil}
              icon={<PerfilInfoIcon />}
            />
          </div>

          <div className="grid-2">
            <SelectField
              label="Porte"
              value={form.porte}
              onChange={(v) => set("porte", v)}
              options={choices?.company_porte}
            />
            <div className="field">
              <Label>Situação</Label>
              <div style={{ paddingTop: 8 }}>
                <Checkbox
                  id="ativo"
                  checked={form.ativo}
                  onCheckedChange={(checked) => set("ativo", checked)}
                  label="Empresa ativa"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={() => navigate(toAbs("empresas"))}>
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
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; label: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="field">
      <Label>{label}{icon}</Label>
      <Select aria-label={label} value={value} onValueChange={onChange} options={options ?? []} />
    </div>
  );
}
