import { useEffect, useState } from "react";
import { Button, Checkbox, Input, Label, Modal, Select } from "@fronteira-ui";
import { useChoices, useSaveEmpresa, type Empresa, type EmpresaInput } from "../hooks/queries";
import { apiError } from "../lib/api";
import { formatCNPJ, onlyDigits } from "../lib/format";
import { PerfilInfoIcon } from "./PerfilInfoIcon";

const EMPTY: EmpresaInput = {
  nome: "",
  cnpj: "",
  tributacao: "simples_irregular",
  porte: "epp",
  perfil: "varejista",
  ativo: true,
};

/** Cadastro rápido de empresa num modal — o usuário cria a empresa sem sair da
 * tela em que está (import, wizard, etc.). Reaproveita os mesmos campos/choices
 * do EmpresaForm. Ao criar, devolve a empresa via `onCreated`. */
export function NovaEmpresaModal({
  open,
  onOpenChange,
  onCreated,
  nomeInicial = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (empresa: Empresa) => void;
  nomeInicial?: string;
}) {
  const { data: choices } = useChoices();
  const save = useSaveEmpresa(null);
  const [form, setForm] = useState<EmpresaInput>(EMPTY);
  const [error, setError] = useState("");

  // Zera o formulário toda vez que o modal abre.
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, nome: nomeInicial });
      setError("");
    }
  }, [open, nomeInicial]);

  function set<K extends keyof EmpresaInput>(key: K, value: EmpresaInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setError("");
    if (!form.nome.trim()) {
      setError("Informe a razão social.");
      return;
    }
    if (onlyDigits(form.cnpj).length !== 14) {
      setError("CNPJ deve ter 14 dígitos.");
      return;
    }
    try {
      const empresa = await save.mutateAsync({ ...form, cnpj: onlyDigits(form.cnpj) });
      onCreated(empresa);
      onOpenChange(false);
    } catch (err) {
      setError(apiError(err, "Não foi possível criar a empresa."));
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova empresa"
      description="Cadastro rápido — você continua na mesma tela."
      actions={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={save.isPending} onClick={submit}>
            {save.isPending ? "Criando…" : "Criar empresa"}
          </Button>
        </>
      }
    >
      <div className="stack gap-16">
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="field">
          <Label htmlFor="ne-nome">Razão social</Label>
          <Input id="ne-nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} autoFocus />
        </div>

        <div className="field">
          <Label htmlFor="ne-cnpj">CNPJ</Label>
          <Input
            id="ne-cnpj"
            className="num"
            value={form.cnpj.length === 14 ? formatCNPJ(form.cnpj) : form.cnpj}
            onChange={(e) => set("cnpj", onlyDigits(e.target.value))}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            maxLength={18}
          />
        </div>

        <div className="grid-2">
          <div className="field">
            <Label>Tributação</Label>
            <Select aria-label="Tributação" value={form.tributacao} onValueChange={(v) => set("tributacao", v)} options={choices?.company_tributacao ?? []} />
          </div>
          <div className="field">
            <Label>Perfil<PerfilInfoIcon /></Label>
            <Select aria-label="Perfil" value={form.perfil} onValueChange={(v) => set("perfil", v)} options={choices?.company_perfil ?? []} />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <Label>Porte</Label>
            <Select aria-label="Porte" value={form.porte} onValueChange={(v) => set("porte", v)} options={choices?.company_porte ?? []} />
          </div>
          <div className="field">
            <Label>Situação</Label>
            <div style={{ paddingTop: 8 }}>
              <Checkbox checked={form.ativo} onCheckedChange={(c) => set("ativo", !!c)} label="Empresa ativa" />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
