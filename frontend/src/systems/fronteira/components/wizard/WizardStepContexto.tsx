import { useEffect, useState } from "react";
import { Badge, Button, Input, Label, Select } from "@fronteira-ui";
import { api, apiError } from "../../lib/api";
import { useLoader } from "../LoaderOverlay";
import { fetchEmpresaPorCnpj, useChoices, type Empresa, type EmpresaInput } from "../../hooks/queries";
import { formatCNPJ } from "../../lib/format";
import { PerfilInfoIcon } from "../PerfilInfoIcon";
import type { InvoiceGroup } from "./types";

const REGIME_PADRAO = { tributacao: "simples_irregular", porte: "epp", perfil: "varejista", ativo: true };

interface GroupForm {
  nome: string;
  tributacao: string;
  porte: string;
  perfil: string;
  ativo: boolean;
}

async function saveEmpresa(existingId: number | null, data: EmpresaInput): Promise<Empresa> {
  const res = existingId
    ? await api.put<Empresa>(`/empresas/${existingId}`, data)
    : await api.post<Empresa>("/empresas", data);
  return res.data;
}

/** Etapa 2 do wizard multi-nota: um card por grupo (empresa destinatária +
 * competência) — não um card por nota. Cada grupo é auto-detectado pelo CNPJ
 * do destinatário; se a empresa já existe, os campos vêm do cadastro
 * (editáveis, e a edição aqui atualiza o cadastro via update_or_create); se
 * é nova, vem pré-preenchida do XML com defaults. A competência de cada
 * grupo vem das próprias notas (não é editável aqui — ver README). */
export function WizardStepContexto({
  groups,
  onChange,
  onNext,
  onBack,
}: {
  groups: InvoiceGroup[];
  onChange: (groups: InvoiceGroup[]) => void;
  onNext: () => void | Promise<void>;
  onBack: () => void;
}) {
  const { data: choices } = useChoices();
  const loader = useLoader();
  const [forms, setForms] = useState<Record<string, GroupForm>>({});
  const [existingIds, setExistingIds] = useState<Record<string, number | null>>({});
  const [loadedKeys, setLoadedKeys] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ativo = true;
    for (const group of groups) {
      if (loadedKeys[group.key]) continue;
      fetchEmpresaPorCnpj(group.cnpj)
        .then((emp) => {
          if (!ativo) return;
          setExistingIds((prev) => ({ ...prev, [group.key]: emp.id }));
          setForms((prev) => ({
            ...prev,
            [group.key]: { nome: emp.nome, tributacao: emp.tributacao, porte: emp.porte, perfil: emp.perfil, ativo: emp.ativo },
          }));
        })
        .catch(() => {
          if (!ativo) return;
          setExistingIds((prev) => ({ ...prev, [group.key]: null }));
          setForms((prev) => ({
            ...prev,
            [group.key]: {
              nome: group.invoices[0]?.destinatario_nome || "",
              ...REGIME_PADRAO,
            },
          }));
        })
        .finally(() => {
          if (ativo) setLoadedKeys((prev) => ({ ...prev, [group.key]: true }));
        });
    }
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  function setField<K extends keyof GroupForm>(key: string, field: K, value: GroupForm[K]) {
    setForms((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  const todosCarregados = groups.length > 0 && groups.every((g) => loadedKeys[g.key]);

  async function handleSalvar() {
    setErro("");
    setSaving(true);
    try {
      const atualizados = await loader.run("Salvando contexto fiscal…", async () => {
        const arr: InvoiceGroup[] = [];
        for (const group of groups) {
          const form = forms[group.key];
          const empresa = await saveEmpresa(existingIds[group.key] ?? null, {
            nome: form.nome,
            cnpj: group.cnpj,
            tributacao: form.tributacao,
            porte: form.porte,
            perfil: form.perfil,
            ativo: form.ativo,
          });
          arr.push({ ...group, companyId: empresa.id, existingCompany: existingIds[group.key] != null });
        }
        return arr;
      });
      onChange(atualizados);
      // Aguarda onNext (pode envolver chamadas assíncronas do passo
      // seguinte, ex.: importar as notas) pra manter o botão em "Salvando…"
      // até a transição de passo realmente terminar.
      await onNext();
    } catch (err) {
      setErro(apiError(err, "Não foi possível salvar uma das empresas."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2 style={{ fontSize: 14 }}>2. Contexto</h2>
        <span className="muted" style={{ fontSize: 13 }}>
          {groups.length} empresa(s) destinatária(s)
        </span>
      </div>
      <div className="card-body stack gap-24">
        {erro && <div className="alert alert-danger">{erro}</div>}

        {groups.map((group) => {
          const form = forms[group.key];
          const loaded = loadedKeys[group.key];
          const existingId = existingIds[group.key];
          const totalNotas = group.invoices.length;
          if (!form) return null;
          return (
            <div key={group.key} className="stack gap-16" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                {loaded && (
                  <Badge variant={existingId ? "ok" : "accent"}>
                    {existingId ? "Empresa já cadastrada" : "Empresa nova — será cadastrada"}
                  </Badge>
                )}
                <Badge variant="neutral">
                  {totalNotas} nota(s) · competência {group.competencia.slice(0, 7)}
                </Badge>
              </div>

              <div className="alert alert-accent">
                Destinatário: <strong>{group.invoices[0]?.destinatario_nome}</strong>{" "}
                <span className="num">({formatCNPJ(group.cnpj)})</span>
              </div>

              <div className="grid-2">
                <div className="field">
                  <Label htmlFor={`${group.key}-nome`}>Razão social</Label>
                  <Input
                    id={`${group.key}-nome`}
                    value={form.nome}
                    onChange={(e) => setField(group.key, "nome", e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <Label htmlFor={`${group.key}-cnpj`}>CNPJ</Label>
                  <Input id={`${group.key}-cnpj`} className="num" value={formatCNPJ(group.cnpj)} readOnly disabled />
                </div>
              </div>

              <div className="grid-3">
                <SelectField
                  label="Tributação"
                  value={form.tributacao}
                  onChange={(v) => setField(group.key, "tributacao", v)}
                  options={choices?.company_tributacao}
                />
                <SelectField
                  label="Perfil"
                  value={form.perfil}
                  onChange={(v) => setField(group.key, "perfil", v)}
                  options={choices?.company_perfil}
                  icon={<PerfilInfoIcon />}
                />
                <SelectField
                  label="Porte"
                  value={form.porte}
                  onChange={(v) => setField(group.key, "porte", v)}
                  options={choices?.company_porte}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "space-between" }}>
        <Button variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <Button variant="primary" disabled={!todosCarregados || saving} loading={saving} onClick={handleSalvar}>
          {saving ? "Salvando…" : "Salvar e Continuar"}
        </Button>
      </div>
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
