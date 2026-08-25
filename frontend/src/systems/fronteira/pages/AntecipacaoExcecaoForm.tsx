import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Button, Checkbox, Input, Label, Select } from "@fronteira-ui";
import {
  useAntecipacaoExcecao,
  useSaveAntecipacaoExcecao,
  type AntecipacaoExcecaoTipoInput,
} from "../hooks/queries";
import { apiError } from "../lib/api";

const TIPO_OPTIONS = [
  { value: "ncm", label: "NCM" },
  { value: "cfop", label: "CFOP" },
  { value: "cst", label: "CST" },
];

const EMPTY: AntecipacaoExcecaoTipoInput = { tipo: "ncm", valor: "", ativo: true };

export default function AntecipacaoExcecaoForm() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();

  const { data: existing } = useAntecipacaoExcecao(editId);
  const save = useSaveAntecipacaoExcecao(editId);

  const [form, setForm] = useState<AntecipacaoExcecaoTipoInput>(EMPTY);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existing) {
      const { id: _id, criado_em, atualizado_em, ...rest } = existing;
      void _id; void criado_em; void atualizado_em;
      setForm(rest);
    }
  }, [existing]);

  function set<K extends keyof AntecipacaoExcecaoTipoInput>(key: K, value: AntecipacaoExcecaoTipoInput[K]) {
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
      navigate(toAbs("antecipacao/excecoes"));
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar."));
    }
  }

  return (
    <div className="stack gap-16" style={{ maxWidth: 560 }}>
      <div>
        <h1 className="page-title">{editId ? "Editar exceção" : "Nova exceção"}</h1>
        <p className="page-sub">Antecipação Interna — regra de exceção por NCM, CFOP ou CST</p>
      </div>

      <form onSubmit={submit} className="card">
        <div className="card-body stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="grid-2">
            <div className="field">
              <Label>Tipo</Label>
              <Select aria-label="Tipo" value={form.tipo} onValueChange={(v) => set("tipo", v)} options={TIPO_OPTIONS} />
            </div>
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
            <Label>Situação</Label>
            <div style={{ paddingTop: 8 }}>
              <Checkbox id="ativo" checked={form.ativo} onCheckedChange={(checked) => set("ativo", !!checked)} label="Exceção ativa" />
            </div>
          </div>
        </div>

        <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={() => navigate(toAbs("antecipacao/excecoes"))}>
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
