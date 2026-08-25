import { useState, type FormEvent } from "react";
import { Badge, Button, Input, Label, Select } from "@fronteira-ui";
import { useCalcularFronteira, useChoices } from "../hooks/queries";
import { apiError } from "../lib/api";
import { formatMoney } from "../lib/format";
import { PerfilInfoIcon } from "../components/PerfilInfoIcon";

export default function CalculoFronteira() {
  const { data: choices } = useChoices();
  const calc = useCalcularFronteira();
  const [error, setError] = useState("");

  const [company, setCompany] = useState({ tributacao: "normal", perfil: "varejista", porte: "epp" });
  const [item, setItem] = useState({
    tributacao: "normal",
    utilizacao: "revenda",
    valor_total: "1000",
    aliq_icms: "0.12",
    valor_icms: "120",
    valor_ipi: "0",
    valor_frete: "0",
    outras_despesas: "0",
    aliq_interna: "0.2050",
  });

  async function run(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await calc.mutateAsync({
        company,
        item: Object.fromEntries(
          Object.entries(item).map(([k, v]) => [k, ["tributacao", "utilizacao"].includes(k) ? v : Number(v)]),
        ),
      });
    } catch (err) {
      setError(apiError(err, "Não foi possível calcular."));
    }
  }

  const result = calc.data;

  return (
    <div className="stack gap-16">
      <div>
        <h1 className="page-title">Cálculo de Fronteira</h1>
        <p className="page-sub">
          Simulação de um item avulso — usa os mesmos calculadores do sistema atual
        </p>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <form onSubmit={run} className="card">
          <div className="card-head">
            <h2 style={{ fontSize: 14 }}>Parâmetros</h2>
          </div>
          <div className="card-body stack gap-16">
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="grid-2">
              <Sel label="Tributação empresa" value={company.tributacao}
                onChange={(v) => setCompany({ ...company, tributacao: v })}
                options={choices?.company_tributacao} />
              <Sel label="Perfil" value={company.perfil}
                onChange={(v) => setCompany({ ...company, perfil: v })}
                options={choices?.company_perfil}
                icon={<PerfilInfoIcon />} />
            </div>

            <div className="frontier-rule" />

            <div className="grid-2">
              <Sel label="Tributação item" value={item.tributacao}
                onChange={(v) => setItem({ ...item, tributacao: v })}
                options={choices?.item_tributacao} />
              <Sel label="Utilização" value={item.utilizacao}
                onChange={(v) => setItem({ ...item, utilizacao: v })}
                options={choices?.item_utilizacao} />
            </div>

            <div className="grid-2">
              <Num label="Valor total" value={item.valor_total} onChange={(v) => setItem({ ...item, valor_total: v })} />
              <Num label="ICMS destacado (R$)" value={item.valor_icms} onChange={(v) => setItem({ ...item, valor_icms: v })} />
            </div>
            <div className="grid-2">
              <Num label="Alíq. origem (0–1)" value={item.aliq_icms} onChange={(v) => setItem({ ...item, aliq_icms: v })} />
              <Num label="Alíq. interna (0–1)" value={item.aliq_interna} onChange={(v) => setItem({ ...item, aliq_interna: v })} />
            </div>
            <div className="grid-2">
              <Num label="IPI (R$)" value={item.valor_ipi} onChange={(v) => setItem({ ...item, valor_ipi: v })} />
              <Num label="Frete (R$)" value={item.valor_frete} onChange={(v) => setItem({ ...item, valor_frete: v })} />
            </div>

            <Button variant="primary" disabled={calc.isPending} style={{ justifyContent: "center" }}>
              {calc.isPending ? "Calculando…" : "Calcular"}
            </Button>
          </div>
        </form>

        <div className="card">
          <div className="card-head">
            <h2 style={{ fontSize: 14 }}>Resultado</h2>
            {result && <Badge variant="accent">{result.formula_nome}</Badge>}
          </div>
          <div className="card-body">
            {!result ? (
              <div className="empty">
                <strong>Sem cálculo ainda</strong>
                Preencha os parâmetros e clique em Calcular.
              </div>
            ) : (
              <div className="stack gap-16">
                <div className="result-total">
                  <span className="muted">Imposto de fronteira</span>
                  <span className="num result-value">{formatMoney(result.valor_resultado)}</span>
                </div>

                <table className="table">
                  <thead>
                    <tr>
                      <th>Passo</th>
                      <th>Fórmula</th>
                      <th className="right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.passos.map((p, i) => (
                      <tr key={i}>
                        <td>{p.descricao}</td>
                        <td className="num muted" style={{ fontSize: 12.5 }}>{p.formula}</td>
                        <td className="right num">{p.valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .result-total { display: flex; flex-direction: column; gap: 4px; padding: 16px; background: var(--primary-tint); border-radius: 8px; }
        .result-value { font-size: 30px; font-weight: 600; color: var(--primary-strong); }
      `}</style>
    </div>
  );
}

function Sel({ label, value, onChange, options, icon }: {
  label: string; value: string; onChange: (v: string) => void; options?: { value: string; label: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="field">
      <Label>{label}{icon}</Label>
      <Select aria-label={label} value={value} onValueChange={onChange} options={options ?? []} />
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <Label>{label}</Label>
      <Input className="num" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
