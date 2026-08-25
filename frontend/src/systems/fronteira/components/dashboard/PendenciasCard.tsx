import { Link } from "react-router-dom";
import type { DashboardPendencia } from "../../hooks/queries";
import { competenciaCurta } from "../../lib/prazo";
import { BlocoEstado } from "./BlocoEstado";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";

const COR_TIPO: Record<string, string> = {
  classificacao: "#ef4444",
  sefaz: "#f59e0b",
  calculo: "#3b82f6",
  regras: "#f59e0b",
};

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "classificacao", label: "Classificação" },
  { id: "sefaz", label: "SEFAZ" },
  { id: "calculo", label: "Cálculo" },
  { id: "regras", label: "Regras" },
];

/** Valor em nota parado na pendência. Não é imposto estimado — para item sem
 * classificação, a tributação é justamente a incógnita, então estimar imposto
 * seria inventar número fiscal. Ver ponto em aberto nº 4 do handoff. */
function valorLabel(valor: string | null): string {
  if (valor == null) return "—";
  const n = Number(valor);
  if (!n) return "—";
  if (n >= 1000) return `~R$ ${Math.round(n / 1000).toLocaleString("pt-BR")}k`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export function PendenciasCard({
  itens,
  filtro,
  onFiltro,
  carregando,
  erro,
  onTentarNovamente,
}: {
  itens: DashboardPendencia[];
  filtro: string;
  onFiltro: (f: string) => void;
  carregando: boolean;
  erro: boolean;
  onTentarNovamente: () => void;
}) {
  const toAbs = useNativeSystemPath();
  const visiveis = filtro === "todas" ? itens : itens.filter((p) => p.tipo === filtro);

  return (
    <div className="dash-card dash-col dash-pendencias">
      <div className="dash-card-head">
        <div className="dash-card-head-left">
          <h2 className="dash-card-titulo">Pendências acionáveis</h2>
          <span className="num dash-badge-contagem dash-badge-accent">
            {carregando || erro ? "—" : visiveis.length}
          </span>
        </div>
        <div className="dash-filtros">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`dash-chip ${filtro === f.id ? "ativo" : ""}`}
              onClick={() => onFiltro(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-lista-scroll dash-flex1">
        <BlocoEstado
          carregando={carregando}
          erro={erro}
          vazio={visiveis.length === 0}
          mensagemVazio="Nenhuma pendência nesta competência."
          titulo="Não foi possível carregar as pendências"
          onTentarNovamente={onTentarNovamente}
        >
          {visiveis.map((p, i) => {
            const cor = COR_TIPO[p.tipo] ?? "#3b82f6";
            return (
              <Link key={`${p.tipo}-${p.company_id}-${i}`} to={toAbs(p.link.replace(/^\//, ""))} className="dash-linha dash-linha-pendencia">
                <span className="dash-ponto" style={{ background: cor }} />
                <span className="dash-min0">
                  <span className="dash-pend-titulo">{p.titulo}</span>
                  <span className="dash-pend-detalhe">{p.detalhe}</span>
                </span>
                <span className="dash-trunc dash-pend-empresa">
                  {p.empresa} · {competenciaCurta(p.competencia)}
                </span>
                <span className="num dash-pend-valor">{valorLabel(p.valor)}</span>
                <span className="dash-pend-acao-wrap">
                  <span
                    className="dash-pill dash-pill-acao"
                    style={{ borderColor: `${cor}33`, background: `${cor}1a`, color: cor }}
                  >
                    {p.acao}
                  </span>
                </span>
              </Link>
            );
          })}
        </BlocoEstado>
      </div>

      <div className="dash-card-rodape">
        <span>Ordenado por valor em nota parado</span>
        <Link to={toAbs("antecipacao/processar")}>Ver todas</Link>
      </div>
    </div>
  );
}
