import { useNavigate } from "react-router-dom";
import type { DashboardEmpresaLinha } from "../../hooks/queries";
import { formatCNPJ, formatMoney } from "../../lib/format";
import { BlocoEstado } from "./BlocoEstado";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";

const STATUS = {
  bloqueado: { label: "Bloqueado", cor: "#ef4444" },
  revisar: { label: "Revisar", cor: "#f59e0b" },
  fechado: { label: "Fechado", cor: "#22c55e" },
  nao_calculado: { label: "Não calculado", cor: "#3b82f6" },
} as const;

/** Zero vira travessão apagado, nunca "0" — numa tabela densa, um monte de
 * zeros é ruído que compete com os números que importam. */
function ouTraco(valor: number, formatar: (v: number) => string): string {
  return valor > 0 ? formatar(valor) : "—";
}

export function EmpresasTabela({
  competencia,
  linhas,
  carregando,
  erro,
  onTentarNovamente,
}: {
  competencia: string;
  linhas: DashboardEmpresaLinha[];
  carregando: boolean;
  erro: boolean;
  onTentarNovamente: () => void;
}) {
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-titulo">Empresas do escopo — competência {competencia}</h2>
        <span className="dash-card-head-hint">Clique numa linha para abrir o histórico da empresa</span>
      </div>

      <BlocoEstado
        carregando={carregando}
        erro={erro}
        vazio={linhas.length === 0}
        mensagemVazio="Nenhuma empresa no seu escopo. Procure o administrador para vincular as empresas que você atende."
        titulo="Não foi possível carregar as empresas"
        onTentarNovamente={onTentarNovamente}
      >
        <div className="dash-tabela-scroll">
          <table className="dash-tabela">
            <thead>
              <tr>
                <th className="dash-th-borda">Empresa</th>
                <th>CNPJ</th>
                <th>Regime</th>
                <th className="right">Notas</th>
                <th className="right">Sem class.</th>
                <th className="right">Diverg.</th>
                <th className="right">Imposto</th>
                <th className="dash-th-borda">Status</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const status = STATUS[l.status as keyof typeof STATUS] ?? STATUS.nao_calculado;
                return (
                  <tr key={l.company_id} onClick={() => navigate(toAbs(l.link.replace(/^\//, "")))}>
                    <td className="dash-td-borda dash-td-nome">{l.nome}</td>
                    <td className="num dash-td-suave">{formatCNPJ(l.cnpj)}</td>
                    <td className="dash-td-suave">{l.regime}</td>
                    <td className="num right">{ouTraco(l.notas, (v) => v.toLocaleString("pt-BR"))}</td>
                    <td className="num right" style={{ color: l.itens_sem_classificacao > 0 ? "#ef4444" : "#6a6a6a" }}>
                      {ouTraco(l.itens_sem_classificacao, (v) => v.toLocaleString("pt-BR"))}
                    </td>
                    <td className="num right" style={{ color: l.divergencias > 0 ? "#f59e0b" : "#6a6a6a" }}>
                      {ouTraco(l.divergencias, (v) => v.toLocaleString("pt-BR"))}
                    </td>
                    <td className="num right dash-td-imposto">{ouTraco(Number(l.imposto), formatMoney)}</td>
                    <td className="dash-td-borda">
                      <span
                        className="dash-pill"
                        style={{
                          borderColor: `${status.cor}33`,
                          background: `${status.cor}1a`,
                          color: status.cor,
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </BlocoEstado>
    </div>
  );
}
