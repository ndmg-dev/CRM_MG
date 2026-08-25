import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Button, Input, Label, Select } from "@fronteira-ui";
import {
  useAntecipacaoMemoria,
  useAntecipacaoTributacoes,
  useSaveAntecipacaoMemoria,
  type AntecipacaoMemoriaInput,
} from "../hooks/queries";
import { EmpresaPicker } from "../components/EmpresaPicker";
import { apiError } from "../lib/api";
import { onlyDigits } from "../lib/format";

// `company_id: 0` é o estado "nenhuma empresa escolhida" — o submit barra
// antes de enviar. A memória é sempre de uma empresa: não existe entrada
// global desde a migration `c4d5e6f7a8b9`.
const EMPTY: AntecipacaoMemoriaInput = {
  company_id: 0,
  ncm: "",
  descricao: "",
  tributacao: "normal_205",
  competencia: null,
};

export default function AntecipacaoMemoriaForm() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();

  const { data: existing } = useAntecipacaoMemoria(editId);
  const save = useSaveAntecipacaoMemoria(editId);
  const { data: tributacoes } = useAntecipacaoTributacoes(true);
  const tributacaoOptions = (tributacoes ?? []).map((t) => ({ value: t.codigo, label: t.nome }));

  const [form, setForm] = useState<AntecipacaoMemoriaInput>(EMPTY);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existing) {
      const { id: _id, descricao_normalizada, criado_em, atualizado_em, ...rest } = existing;
      void _id; void descricao_normalizada; void criado_em; void atualizado_em;
      setForm(rest);
    }
  }, [existing]);

  function set<K extends keyof AntecipacaoMemoriaInput>(key: K, value: AntecipacaoMemoriaInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.company_id) {
      setError("Selecione a empresa.");
      return;
    }
    if (onlyDigits(form.ncm).length === 0) {
      setError("NCM é obrigatório.");
      return;
    }
    try {
      await save.mutateAsync({ ...form, ncm: onlyDigits(form.ncm) });
      navigate(toAbs("antecipacao"));
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar."));
    }
  }

  return (
    <div className="stack gap-16" style={{ maxWidth: 560 }}>
      <div>
        <h1 className="page-title">{editId ? "Editar entrada de memória" : "Nova entrada de memória"}</h1>
        <p className="page-sub">Antecipação Interna — NCM + descrição → tributação</p>
      </div>

      <form onSubmit={submit} className="card">
        <div className="card-body stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}

          <EmpresaPicker
            value={form.company_id || null}
            onChange={(id) => set("company_id", id ?? 0)}
            hint="A classificação vale só para esta empresa."
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
            </div>
            <div className="field">
              <Label>Tributação</Label>
              <Select
                aria-label="Tributação"
                value={form.tributacao}
                onValueChange={(v) => set("tributacao", v)}
                options={tributacaoOptions}
              />
            </div>
          </div>

          <div className="field">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
          </div>

          <div className="field" style={{ maxWidth: 220 }}>
            <Label htmlFor="competencia">Competência (opcional)</Label>
            <Input
              id="competencia"
              type="month"
              value={form.competencia ? form.competencia.slice(0, 7) : ""}
              onChange={(e) => set("competencia", e.target.value ? `${e.target.value}-01` : null)}
            />
          </div>
        </div>

        <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={() => navigate(toAbs("antecipacao"))}>
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
