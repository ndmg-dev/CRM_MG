import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Button, Checkbox, Input, Label, Select } from "@fronteira-ui";
import { useChoices, useExcecao, useSaveExcecao, type FiscalExceptionInput } from "../hooks/queries";
import { apiError } from "../lib/api";

const EMPTY: FiscalExceptionInput = {
  tipo: "ncm",
  valor: "",
  descricao_produto: "",
  acao: "ignorar",
  escopo: "todos",
  motivo: "",
  ativo: true,
};

export default function ExcecaoForm() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();

  const { data: choices } = useChoices();
  const { data: existing } = useExcecao(editId);
  const save = useSaveExcecao(editId);

  const [form, setForm] = useState<FiscalExceptionInput>(EMPTY);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existing) {
      const { id: _id, criado_em, atualizado_em, ...rest } = existing;
      void _id; void criado_em; void atualizado_em;
      setForm(rest);
    }
  }, [existing]);

  function set<K extends keyof FiscalExceptionInput>(key: K, value: FiscalExceptionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.valor.trim()) {
      setError("Valor (NCM/CFOP/CST a casar) é obrigatório.");
      return;
    }
    try {
      await save.mutateAsync({ ...form, valor: form.valor.trim() });
      navigate(toAbs("excecoes"));
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar."));
    }
  }

  return (
    <div className="stack gap-16" style={{ maxWidth: 640 }}>
      <div>
        <h1 className="page-title">{editId ? "Editar exceção" : "Nova exceção"}</h1>
        <p className="page-sub">Regra de exceção fiscal por NCM, CFOP ou CST</p>
      </div>

      <form onSubmit={submit} className="card">
        <div className="card-body stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="grid-2">
            <SelectField label="Tipo" value={form.tipo} onChange={(v) => set("tipo", v)} options={choices?.exception_tipo} />
            <div className="field">
              <Label htmlFor="valor">Valor a casar</Label>
              <Input
                id="valor"
                className="num"
                value={form.valor}
                onChange={(e) => set("valor", e.target.value)}
                placeholder="Ex.: 21069090 (NCM), 6108 (CFOP), 60 (CST)"
                required
              />
            </div>
          </div>

          <div className="field">
            <Label htmlFor="descricao_produto">Descrição do produto (opcional)</Label>
            <Input
              id="descricao_produto"
              value={form.descricao_produto}
              onChange={(e) => set("descricao_produto", e.target.value)}
            />
          </div>

          <div className="grid-2">
            <SelectField label="Ação" value={form.acao} onChange={(v) => set("acao", v)} options={choices?.exception_acao} />
            <SelectField
              label="Escopo"
              value={form.escopo}
              onChange={(v) => set("escopo", v)}
              options={choices?.exception_escopo}
            />
          </div>

          <div className="field">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Input id="motivo" value={form.motivo} onChange={(e) => set("motivo", e.target.value)} />
          </div>

          <div className="field">
            <Label>Situação</Label>
            <div style={{ paddingTop: 8 }}>
              <Checkbox
                id="ativo"
                checked={form.ativo}
                onCheckedChange={(checked) => set("ativo", checked)}
                label="Exceção ativa"
              />
            </div>
          </div>
        </div>

        <div
          className="card-head"
          style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "flex-end" }}
        >
          <Button type="button" variant="ghost" onClick={() => navigate(toAbs("excecoes"))}>
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
