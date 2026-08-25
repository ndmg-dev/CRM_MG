import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Badge } from "@fronteira-ui";
import { EmpresaPicker } from "../components/EmpresaPicker";
import { useAntecipacaoCompetencias, type Empresa } from "../hooks/queries";
import { apiError } from "../lib/api";
import { formatCNPJ, formatMoney } from "../lib/format";

const SITUACAO_LABEL: Record<string, string> = {
  aguardando_classificacao: "Aguardando classificação",
  pronto_para_calcular: "Pronto para calcular",
  calculado: "Calculado",
};

const SITUACAO_VARIANT: Record<string, "ok" | "neutral" | "warn"> = {
  aguardando_classificacao: "warn",
  pronto_para_calcular: "neutral",
  calculado: "ok",
};

function competenciaLabel(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

/** Histórico da Antecipação Interna — mesmo padrão do Histórico de
 * Fronteira: escolhe a empresa, vê o que já foi importado por competência
 * (sem "lote" — cada linha é uma competência), clica pra abrir o
 * processamento daquela competência. Aqui a empresa só pode ser
 * selecionada entre as já cadastradas (sem "+ Nova empresa" nesta tela). */
export default function AntecipacaoHistorico() {
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | undefined>();

  const { data, isLoading, error } = useAntecipacaoCompetencias(companyId);

  function abrir(competencia: string) {
    navigate(toAbs(`antecipacao/processar/${companyId}/${competencia}`));
  }

  return (
    <div className="stack gap-16">
      <div>
        <h1 className="page-title">Histórico — Antecipação</h1>
        <p className="page-sub">Consulte o que já foi importado, por empresa e competência.</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 style={{ fontSize: 14 }}>1. Empresa</h2>
          {companyId && <Badge variant="ok">Empresa selecionada</Badge>}
        </div>
        <div className="card-body stack gap-16">
          <EmpresaPicker
            label="Empresa"
            value={companyId}
            allowCreate={false}
            onChange={(id, e) => {
              setCompanyId(id);
              setEmpresa(e);
            }}
          />
        </div>
      </div>

      {companyId && (
        <div className="card">
          <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="stack" style={{ gap: 2 }}>
              <h2 style={{ fontSize: 14 }}>Competências de {empresa?.nome}</h2>
              {empresa && <span className="muted num" style={{ fontSize: 12.5 }}>{formatCNPJ(empresa.cnpj)}</span>}
            </div>
          </div>

          {isLoading ? (
            <div className="empty">Carregando…</div>
          ) : error ? (
            <div className="empty">
              <strong>Não foi possível carregar</strong>
              {apiError(error)}
            </div>
          ) : !data?.length ? (
            <div className="empty">
              <strong>Nenhuma competência encontrada</strong>
              Essa empresa ainda não teve notas importadas na Antecipação.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th className="right">Notas</th>
                    <th className="right">Itens</th>
                    <th className="right">Imposto total</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.competencia} style={{ cursor: "pointer" }} onClick={() => abrir(c.competencia)}>
                      <td className="num"><strong>{competenciaLabel(c.competencia)}</strong></td>
                      <td className="right num">{c.total_notas}</td>
                      <td className="right num">{c.total_itens}</td>
                      <td className="right num">{formatMoney(c.total_imposto)}</td>
                      <td>
                        <Badge variant={SITUACAO_VARIANT[c.situacao]}>{SITUACAO_LABEL[c.situacao] ?? c.situacao}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
