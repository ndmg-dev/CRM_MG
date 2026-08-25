import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Button, Checkbox, Input, Label } from "@fronteira-ui";
import {
  useAntecipacaoTributacoes,
  useAtualizarAntecipacaoTributacao,
  useCriarAntecipacaoTributacao,
} from "../hooks/queries";
import { apiError } from "../lib/api";

export default function AntecipacaoTributacaoForm() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();

  const { data: lista } = useAntecipacaoTributacoes();
  const existing = editId != null ? lista?.find((t) => t.id === editId) : null;
  const criar = useCriarAntecipacaoTributacao();
  const atualizar = useAtualizarAntecipacaoTributacao(editId ?? 0);

  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [zeraImposto, setZeraImposto] = useState(false);
  const [ehNst, setEhNst] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existing) {
      setCodigo(existing.codigo);
      setNome(existing.nome);
      setZeraImposto(existing.zera_imposto);
      setEhNst(existing.eh_nst);
      setAtivo(existing.ativo);
    }
  }, [existing]);

  const salvando = criar.isPending || atualizar.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!nome.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    if (!editId && !codigo.trim()) {
      setError("Código é obrigatório.");
      return;
    }
    try {
      if (editId) {
        await atualizar.mutateAsync({ nome, zera_imposto: zeraImposto, eh_nst: ehNst, ativo });
      } else {
        await criar.mutateAsync({ codigo, nome, zera_imposto: zeraImposto, eh_nst: ehNst, ativo });
      }
      navigate(toAbs("antecipacao/tributacoes"));
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar."));
    }
  }

  return (
    <div className="stack gap-16" style={{ maxWidth: 560 }}>
      <div>
        <h1 className="page-title">{editId ? "Editar tributação" : "Nova tributação"}</h1>
        <p className="page-sub">Código de tributação da Antecipação Interna</p>
      </div>

      <form onSubmit={submit} className="card">
        <div className="card-body stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="field">
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              className="num"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="ex.: normal_205"
              disabled={!!editId}
              required
            />
          </div>

          <div className="field">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>

          <div className="stack gap-8">
            <Checkbox
              id="zera_imposto"
              checked={zeraImposto}
              onCheckedChange={(v) => setZeraImposto(!!v)}
              label="Zera imposto (item classificado com esse código nunca gera imposto)"
            />
            <Checkbox
              id="eh_nst"
              checked={ehNst}
              onCheckedChange={(v) => setEhNst(!!v)}
              label="É NST (zera o imposto só quando o ICMS-ST já vier destacado na nota)"
            />
            <Checkbox id="ativo" checked={ativo} onCheckedChange={(v) => setAtivo(!!v)} label="Tributação ativa" />
          </div>
        </div>

        <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={() => navigate(toAbs("antecipacao/tributacoes"))}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
