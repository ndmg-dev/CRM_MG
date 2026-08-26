import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { useAuth } from "../auth/AuthContext";
import {
  useDashboardEmpresas,
  useDashboardPendencias,
  useDashboardResumo,
  useDashboardSaude,
  useDashboardSeries,
  useEmpresas,
  type DashboardSeries,
} from "../hooks/queries";
import { competenciaCurta } from "../lib/prazo";
import { EmpresasAbertas } from "../components/dashboard/EmpresasAbertas";
import { EmpresasTabela } from "../components/dashboard/EmpresasTabela";
import { KpiCards } from "../components/dashboard/KpiCards";
import { PendenciasCard } from "../components/dashboard/PendenciasCard";
import { PrazoCard } from "../components/dashboard/PrazoCard";
import { SaudeCard } from "../components/dashboard/SaudeCard";
import { SerieChart } from "../components/dashboard/SerieChart";

const PAPEL_LABEL: Record<string, string> = {
  operador: "Operador",
  coordenador: "Coordenador",
  administrador: "Administrador",
};

function saudacao(hora = new Date().getHours()): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function competenciaCorrente(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/** "dados de DD/MM HH:MM" + ponto de frescor. O timestamp é obrigatório na
 * tela: número fiscal desatualizado é pior que número ausente. */
function Frescor({ geradoEm }: { geradoEm: string | undefined }) {
  if (!geradoEm) return null;
  const data = new Date(geradoEm);
  const minutos = (Date.now() - data.getTime()) / 60_000;
  const cor = minutos > 15 ? "#f59e0b" : "#22c55e";
  const carimbo = `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")} ${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
  return (
    <span className="dash-frescor">
      <span className="dash-frescor-ponto" style={{ background: cor }} />
      dados de <span className="num">{carimbo}</span>
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [competencia, setCompetencia] = useState(competenciaCorrente());
  const [filtroPendencia, setFiltroPendencia] = useState("todas");
  const [abaGrafico, setAbaGrafico] = useState<keyof DashboardSeries>("volume");

  const filtros = { competencia, companyId };
  const resumo = useDashboardResumo(filtros);
  const pendencias = useDashboardPendencias(filtros);
  const series = useDashboardSeries(filtros);
  const saude = useDashboardSaude(filtros);
  const empresasDados = useDashboardEmpresas(filtros);

  // Alimenta só o seletor de empresa — a listagem já vem escopada do servidor.
  const { data: empresas } = useEmpresas("", { ativo: true, limit: 200 });

  const competenciasDisponiveis = resumo.data?.competencias_disponiveis ?? [competencia];
  const totalEscopo = resumo.data?.empresas_no_escopo ?? 0;
  const semApuracao = empresasDados.data?.sem_apuracao ?? [];

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <div className="dash-eyebrow">Fronteira v8 · Compliance fiscal</div>
          <h1 className="dash-h1">
            {saudacao()}, {(user?.full_name || user?.username || "").split(" ")[0]}
          </h1>
          <div className="dash-sub">
            <span>
              <span className="num dash-sub-num">{totalEscopo}</span> empresas no seu escopo · perfil{" "}
              <span className="dash-sub-papel">{PAPEL_LABEL[user?.role ?? ""] ?? user?.role}</span>
            </span>
            <span className="dash-sub-sep">|</span>
            <Frescor geradoEm={resumo.data?.gerado_em} />
          </div>
        </div>

        <div className="dash-header-acoes">
          <button type="button" className="dash-btn-primario" onClick={() => navigate(toAbs("antecipacao/processar"))}>
            Processar competência
          </button>
          <button type="button" className="dash-btn-secundario" onClick={() => navigate(toAbs("comparacao/nova"))}>
            Nova comparação SEFAZ
          </button>
          <span className="dash-divisor" />
          <label className="dash-seletor">
            <span className="dash-seletor-label">Empresa</span>
            <select
              value={companyId ?? "all"}
              onChange={(e) => setCompanyId(e.target.value === "all" ? null : Number(e.target.value))}
            >
              <option value="all">Todas do meu escopo</option>
              {(empresas ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="dash-seletor">
            <span className="dash-seletor-label">Competência</span>
            <select className="num" value={competencia} onChange={(e) => setCompetencia(e.target.value)}>
              {competenciasDisponiveis.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="dash-faixa-prazo">
        <PrazoCard
          competencia={competencia}
          apuradas={resumo.data?.apuradas ?? 0}
          totalEscopo={totalEscopo}
          vencidas={semApuracao.filter((e) => competenciaCurta(e.competencia) < competenciaCorrente()).length}
          carregando={resumo.isLoading}
        />
        <EmpresasAbertas
          itens={semApuracao}
          carregando={empresasDados.isLoading}
          erro={!!empresasDados.error}
          onTentarNovamente={() => empresasDados.refetch()}
        />
      </div>

      <KpiCards resumo={resumo.data} carregando={resumo.isLoading} erro={!!resumo.error} />

      <div className="dash-corpo">
        <PendenciasCard
          itens={pendencias.data ?? []}
          filtro={filtroPendencia}
          onFiltro={setFiltroPendencia}
          carregando={pendencias.isLoading}
          erro={!!pendencias.error}
          onTentarNovamente={() => pendencias.refetch()}
        />
        <div className="dash-coluna-direita">
          <SerieChart
            series={series.data}
            aba={abaGrafico}
            onAba={setAbaGrafico}
            carregando={series.isLoading}
            erro={!!series.error}
            onTentarNovamente={() => series.refetch()}
          />
          <SaudeCard
            saude={saude.data}
            carregando={saude.isLoading}
            erro={!!saude.error}
            onTentarNovamente={() => saude.refetch()}
          />
        </div>
      </div>

      <EmpresasTabela
        competencia={competencia}
        linhas={empresasDados.data?.linhas ?? []}
        carregando={empresasDados.isLoading}
        erro={!!empresasDados.error}
        onTentarNovamente={() => empresasDados.refetch()}
      />

      <style>{css}</style>
    </div>
  );
}

const css = `
.dash { display: flex; flex-direction: column; gap: 14px; }

/* ─── Cabeçalho ─────────────────────────────────────────────────────────── */
.dash-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; margin-bottom: 8px; }
.dash-eyebrow { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #8a8a8a; font-weight: 600; margin-bottom: 6px; }
.dash-h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -.01em; color: #f5f5f5; }
.dash-sub { margin-top: 7px; font-size: 13px; color: #8a8a8a; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dash-sub-num { color: #c9c9c9; }
.dash-sub-papel { color: #d4a843; }
.dash-sub-sep { color: #3a3a3a; }
.dash-frescor { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #7a7a7a; }
.dash-frescor-ponto { width: 6px; height: 6px; border-radius: 999px; }

.dash-header-acoes { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.dash-btn-primario, .dash-btn-secundario {
  border-radius: 8px; padding: 9px 14px; font-size: 13px; font-family: var(--font-ui); cursor: pointer;
}
.dash-btn-primario { background: #d4a843; color: #0a0a0a; border: 0; font-weight: 600; }
.dash-btn-primario:hover { background: #c9952b; }
.dash-btn-secundario { background: transparent; color: #c9c9c9; border: 1px solid #333; font-weight: 500; }
.dash-btn-secundario:hover { border-color: #444; color: #f5f5f5; }
.dash-divisor { width: 1px; height: 24px; background: #262626; }
.dash-seletor { display: flex; align-items: center; gap: 8px; background: #1a1a1a; border: 1px solid #262626; border-radius: 8px; padding: 7px 10px; }
.dash-seletor-label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #7a7a7a; font-weight: 600; }
.dash-seletor select { background: transparent; border: 0; color: #e5e5e5; font-family: var(--font-ui); font-size: 13px; outline: none; cursor: pointer; max-width: 220px; }
.dash-seletor select.num { font-family: var(--font-num); }
.dash-seletor option { background: #1a1a1a; }

/* ─── Cards ─────────────────────────────────────────────────────────────── */
.dash-card { background: #1a1a1a; border: 1px solid #262626; border-radius: 10px; min-width: 0; }
.dash-col { display: flex; flex-direction: column; }
.dash-flex1 { flex: 1; }
.dash-card-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; border-bottom: 1px solid #262626; }
.dash-card-head-left { display: flex; align-items: center; gap: 10px; }
.dash-card-titulo { margin: 0; font-size: 14px; font-weight: 600; color: #f5f5f5; }
.dash-card-head-hint { font-size: 12px; color: #7a7a7a; }
.dash-card-rodape { padding: 11px 18px; border-top: 1px solid #262626; font-size: 12px; color: #7a7a7a; display: flex; justify-content: space-between; gap: 12px; }
.dash-label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #8a8a8a; font-weight: 600; }
.dash-badge-contagem { font-size: 11px; color: #0a0a0a; border-radius: 999px; padding: 2px 8px; font-weight: 600; }
.dash-badge-erro { background: #ef4444; }
.dash-badge-accent { background: #d4a843; }
.dash-pill { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 3px 9px; white-space: nowrap; border: 1px solid transparent; }
.dash-pill-acao { text-transform: uppercase; letter-spacing: .04em; padding: 4px 10px; }
.dash-min0 { min-width: 0; }
.dash-trunc { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ─── Faixa de prazo ────────────────────────────────────────────────────── */
.dash-faixa-prazo { display: grid; grid-template-columns: minmax(0, 290px) minmax(0, 1fr); gap: 14px; }
.dash-prazo { padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; }
.dash-prazo-num-row { display: flex; align-items: baseline; gap: 10px; margin-top: 12px; }
.dash-prazo-num { font-size: 44px; font-weight: 600; line-height: 1; }
.dash-prazo-label { font-size: 12.5px; color: #9a9a9a; line-height: 1.3; }
.dash-prazo-data { margin-top: 9px; font-size: 12.5px; color: #7a7a7a; }
.dash-prazo-data-valor { color: #c9c9c9; }
.dash-prazo-progresso-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #8a8a8a; }
.dash-prazo-progresso-valor { font-size: 14px; color: #f5f5f5; }
.dash-progresso-trilho { height: 6px; border-radius: 999px; background: #262626; overflow: hidden; }
.dash-progresso-fill { height: 100%; background: #d4a843; border-radius: 999px; transition: width 160ms ease; }
.dash-prazo-vencidas { margin-top: 9px; font-size: 12px; color: #7a7a7a; }
.dash-prazo-vencidas-num { color: #ef4444; }

.dash-lista-scroll { overflow: auto; }
.dash-lista-abertas { max-height: 240px; }
.dash-linha { display: grid; align-items: center; gap: 14px; padding: 11px 18px; border-bottom: 1px solid #202020; color: inherit; text-decoration: none; }
.dash-linha:hover { background: #202020; text-decoration: none; }
.dash-linha-aberta { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) 100px 150px; }
.dash-linha-nome { font-size: 13px; color: #e9e9e9; font-weight: 500; }
.dash-linha-motivo { font-size: 12px; color: #7a7a7a; }
.dash-linha-comp { font-size: 12px; color: #9a9a9a; text-align: right; }
.dash-linha-prazo { display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
.dash-linha-prazo-data { font-size: 11px; color: #6a6a6a; }

/* ─── KPIs ──────────────────────────────────────────────────────────────── */
.dash-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.dash-kpi { padding: 16px 18px; position: relative; overflow: hidden; }
.dash-kpi-barra { position: absolute; left: 0; top: 0; bottom: 0; width: 2px; }
.dash-kpi-valor-row { display: flex; align-items: baseline; gap: 9px; margin: 10px 0 8px; min-width: 0; }
.dash-kpi-valor { font-size: clamp(20px, 2.1vw, 32px); font-weight: 600; color: #f5f5f5; white-space: nowrap; }
.dash-kpi-complemento { font-size: 12px; color: #7a7a7a; }
.dash-kpi-rodape { font-size: 12px; color: #7a7a7a; line-height: 1.5; }
.dash-kpi-rodape-num { color: #c9c9c9; }
.dash-kpi-parcelas { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11px; color: #7a7a7a; }

/* ─── Corpo ─────────────────────────────────────────────────────────────── */
.dash-corpo { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 14px; }
.dash-pendencias { min-height: 380px; }
.dash-coluna-direita { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.dash-filtros { display: flex; gap: 6px; flex-wrap: wrap; }
.dash-chip {
  background: transparent; color: #9a9a9a; border: 1px solid #333; border-radius: 999px;
  padding: 4px 11px; font-size: 11px; font-weight: 600; font-family: var(--font-ui); cursor: pointer;
}
.dash-chip:hover { border-color: #444; color: #e5e5e5; }
.dash-chip.ativo { background: #d4a843; border-color: #d4a843; color: #0a0a0a; }

.dash-linha-pendencia { grid-template-columns: 8px minmax(0, 1.5fr) minmax(0, 1fr) 110px 120px; padding: 13px 18px; }
.dash-ponto { width: 6px; height: 6px; border-radius: 999px; }
.dash-pend-titulo { display: block; font-size: 13px; color: #e9e9e9; font-weight: 500; }
.dash-pend-detalhe { display: block; font-size: 12px; color: #7a7a7a; margin-top: 3px; }
.dash-pend-empresa { font-size: 12px; color: #9a9a9a; }
.dash-pend-valor { font-size: 13px; color: #e9e9e9; text-align: right; }
.dash-pend-acao-wrap { display: flex; justify-content: flex-end; }

/* ─── Gráfico ───────────────────────────────────────────────────────────── */
.dash-chart { padding: 16px 18px; }
.dash-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; flex-wrap: wrap; }
.dash-chart-unidade { font-size: 11px; color: #7a7a7a; text-transform: uppercase; letter-spacing: .08em; }
.dash-abas { display: flex; gap: 5px; }
.dash-aba {
  background: transparent; color: #8a8a8a; border: 1px solid transparent; border-radius: 6px;
  padding: 4px 9px; font-size: 11px; font-weight: 600; font-family: var(--font-ui); cursor: pointer;
}
.dash-aba:hover { border-color: #444; }
.dash-aba.ativa { background: #262626; border-color: #3a3a3a; color: #f5f5f5; }
.dash-chart-barras { display: flex; align-items: flex-end; gap: 8px; height: 150px; margin: 18px 0 8px; }
.dash-chart-coluna { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 3px; height: 100%; min-width: 0; }
.dash-chart-segmento { width: 100%; }
.dash-chart-rotulos { display: flex; gap: 8px; }
.dash-chart-rotulo { flex: 1; text-align: center; font-size: 10px; color: #9a9a9a; }
.dash-chart-rotulo.parcial { color: #7a7a7a; }
.dash-chart-legenda { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 14px; padding-top: 12px; border-top: 1px solid #262626; font-size: 12px; color: #8a8a8a; }
.dash-chart-legenda-item { display: flex; align-items: center; gap: 6px; }
.dash-chart-legenda-cor { width: 8px; height: 8px; border-radius: 2px; }

/* ─── Saúde ─────────────────────────────────────────────────────────────── */
.dash-saude { padding: 16px 18px; flex: 1; }
.dash-saude-titulo { margin-bottom: 14px; }
.dash-saude-linha { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #202020; }
.dash-saude-label { font-size: 13px; color: #c9c9c9; }
.dash-saude-direita { display: flex; align-items: center; gap: 10px; }
.dash-saude-valor { font-size: 13px; color: #e9e9e9; }

/* ─── Tabela ────────────────────────────────────────────────────────────── */
.dash-tabela-scroll { overflow-x: auto; }
.dash-tabela { width: 100%; border-collapse: collapse; min-width: 900px; }
.dash-tabela th {
  text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .1em;
  color: #7a7a7a; font-weight: 600; border-bottom: 1px solid #262626; white-space: nowrap;
}
.dash-tabela th.dash-th-borda { padding-left: 18px; padding-right: 18px; }
.dash-tabela th.right, .dash-tabela td.right { text-align: right; }
.dash-tabela td { padding: 12px; font-size: 13px; color: #e9e9e9; border-bottom: 1px solid #202020; white-space: nowrap; }
.dash-tabela td.dash-td-borda { padding-left: 18px; padding-right: 18px; }
.dash-tabela td.dash-td-suave { font-size: 12px; color: #9a9a9a; }
.dash-tabela td.dash-td-imposto { color: #d4a843; }
.dash-tabela tbody tr { cursor: pointer; }
.dash-tabela tbody tr:hover { background: #202020; }

/* ─── Estados ───────────────────────────────────────────────────────────── */
.dash-skeleton-wrap { padding: 6px 18px; }
.dash-skeleton-row { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid #202020; }
.dash-skeleton-dot { width: 6px; height: 6px; border-radius: 999px; background: #2e2e2e; flex-shrink: 0; }
.dash-skeleton-main { flex: 1.5; min-width: 0; }
.dash-skeleton-bar { border-radius: 3px; }
.dash-skeleton-bar-lg { height: 11px; width: 70%; background: #242424; }
.dash-skeleton-bar-sm { height: 9px; width: 45%; background: #1f1f1f; margin-top: 7px; }
.dash-skeleton-block { width: 110px; height: 10px; background: #222; border-radius: 3px; flex-shrink: 0; }
.dash-skeleton-pill { width: 74px; height: 18px; background: #222; border-radius: 999px; flex-shrink: 0; }

.dash-erro { padding: 52px 24px; text-align: center; }
.dash-erro-icone {
  display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px;
  border-radius: 999px; border: 1px solid #ef444444; background: #ef44441a; color: #ef4444; font-size: 16px; font-weight: 700;
}
.dash-erro-titulo { margin-top: 14px; font-size: 14px; color: #e5e5e5; font-weight: 500; }
.dash-erro-texto { margin: 6px auto 0; font-size: 12.5px; color: #7a7a7a; line-height: 1.6; max-width: 380px; }
.dash-btn-retry {
  margin-top: 16px; background: transparent; color: #d4a843; border: 1px solid #d4a84355; border-radius: 8px;
  padding: 7px 14px; font-size: 12.5px; font-weight: 600; font-family: var(--font-ui); cursor: pointer;
}
.dash-btn-retry:hover { border-color: #d4a843; }
.dash-vazio { padding: 40px 24px; text-align: center; font-size: 13px; color: #7a7a7a; }

@media (max-width: 1100px) {
  .dash-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dash-corpo, .dash-faixa-prazo { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 620px) {
  .dash-kpis { grid-template-columns: minmax(0, 1fr); }
  .dash-linha-aberta, .dash-linha-pendencia { grid-template-columns: minmax(0, 1fr); gap: 6px; }
}
`;
