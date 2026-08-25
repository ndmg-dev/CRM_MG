import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Badge, Button, Input } from "@fronteira-ui";
import { useDeleteNcmRule, useNcmRules } from "../hooks/queries";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/ConfirmDialog";
import { EmpresaPicker } from "../components/EmpresaPicker";
import { Pagination } from "../components/Pagination";
import { formatRate } from "../lib/format";
import { apiError } from "../lib/api";

const TRIB_LABEL: Record<string, string> = {
  normal: "Normal",
  st: "ST",
  rbc: "RBC",
  isento: "Isento",
};

export default function NcmRules() {
  // A regra NCM é sempre de uma empresa. Sem empresa escolhida a tela não
  // lista nada — misturar a classificação de contribuintes diferentes numa
  // única lista é convite a editar a regra da empresa errada.
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [ncm, setNcm] = useState("");
  const [offset, setOffset] = useState(0);
  const [erro, setErro] = useState("");
  const { data, isLoading, error } = useNcmRules(companyId, ncm, offset);
  const del = useDeleteNcmRule();
  const { isCoordenador } = useAuth();
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const confirm = useConfirm();

  async function handleDelete(id: number, ncmValor: string) {
    const ok = await confirm({
      title: "Excluir regra NCM",
      message: `Excluir a regra do NCM "${ncmValor}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setErro("");
    try {
      await del.mutateAsync(id);
    } catch (e) {
      setErro(apiError(e, "Não foi possível excluir."));
    }
  }

  return (
    <div className="stack gap-16">
      <div className="row">
        <div>
          <h1 className="page-title">Regras NCM/MVA</h1>
          <p className="page-sub">Tributação e margem de valor agregado por NCM</p>
        </div>
        <div className="spacer" />
        {isCoordenador && (
          <Button
            variant="primary"
            disabled={!companyId}
            onClick={() => navigate(toAbs(`ncm-rules/nova?company_id=${companyId}`))}
          >
            Nova regra
          </Button>
        )}
      </div>

      {erro && <div className="alert alert-danger">{erro}</div>}

      <div className="card">
        <div className="card-body" style={{ maxWidth: 420 }}>
          <EmpresaPicker
            value={companyId}
            onChange={(id) => {
              setCompanyId(id);
              setNcm("");
              setOffset(0);
            }}
            allowCreate={false}
            hint="As regras NCM/MVA são por empresa."
          />
        </div>
      </div>

      {!companyId ? (
        <div className="card">
          <div className="empty">
            <strong>Selecione a empresa</strong>
            As regras de tributação e MVA são definidas por empresa — escolha uma acima para ver as
            regras dela.
          </div>
        </div>
      ) : (
      <div className="card">
        <div className="card-head">
          <Input
            className="num"
            placeholder="Buscar por NCM…"
            value={ncm}
            onChange={(e) => {
              setNcm(e.target.value);
              setOffset(0);
            }}
            style={{ maxWidth: 320 }}
          />
          <span className="muted" style={{ fontSize: 13 }}>
            {data ? `${data.total} regra(s)` : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="empty">Carregando…</div>
        ) : error ? (
          <div className="empty">
            <strong>Não foi possível carregar</strong>
            {apiError(error)}
          </div>
        ) : !data?.items.length ? (
          <div className="empty">
            <strong>Nenhuma regra encontrada</strong>
            {ncm ? "Tente outro NCM." : "Cadastre a primeira regra para começar."}
          </div>
        ) : (
          <>
          <table className="table">
            <thead>
              <tr>
                <th>NCM</th>
                <th>Descrição</th>
                <th>Tributação</th>
                <th>MVA original</th>
                <th>Alíquota interna</th>
                <th>Situação</th>
                {isCoordenador && <th className="right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.ncm}</td>
                  <td>{r.descricao || "—"}</td>
                  <td>{TRIB_LABEL[r.tributacao] ?? r.tributacao}</td>
                  <td className="num">{formatRate(r.mva_original)}</td>
                  <td className="num">{formatRate(r.aliquota_interna)}</td>
                  <td>
                    <Badge variant={r.ativo ? "ok" : "neutral"}>{r.ativo ? "Ativa" : "Inativa"}</Badge>
                  </td>
                  {isCoordenador && (
                    <td className="right">
                      <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
                        <Button variant="ghost" size="sm" onClick={() => navigate(toAbs(`ncm-rules/${r.id}/editar`))}>
                          Editar
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(r.id, r.ncm)}>
                          Excluir
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination total={data.total} offset={data.offset} count={data.items.length} onChange={setOffset} />
          </>
        )}
      </div>
      )}
    </div>
  );
}
