import type { DashboardResumo } from "../../hooks/queries";

const CORES = {
  pendentes: "#ef4444",
  sefaz: "#f59e0b",
  calculo: "#3b82f6",
  imposto: "#d4a843",
};

function inteiro(v: number): string {
  return v.toLocaleString("pt-BR");
}

/** Valor monetário sem o prefixo "R$" — a moeda vai no rótulo do card. É o que
 * faz o número caber em 1/4 da largura (ver handoff); não reintroduzir. */
function moedaSemPrefixo(v: string | number): string {
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function Kpi({
  titulo,
  cor,
  valor,
  valorCor,
  complemento,
  rodape,
}: {
  titulo: string;
  cor: string;
  valor: string;
  valorCor?: string;
  complemento?: React.ReactNode;
  rodape: React.ReactNode;
}) {
  return (
    <div className="dash-card dash-kpi">
      <span className="dash-kpi-barra" style={{ background: cor }} />
      <div className="dash-label">{titulo}</div>
      <div className="dash-kpi-valor-row">
        <span className="num dash-kpi-valor" style={valorCor ? { color: valorCor } : undefined}>
          {valor}
        </span>
        {complemento}
      </div>
      <div className="dash-kpi-rodape">{rodape}</div>
    </div>
  );
}

export function KpiCards({
  resumo,
  carregando,
  erro,
}: {
  resumo: DashboardResumo | undefined;
  carregando: boolean;
  erro: boolean;
}) {
  // Sem dado confiável, o valor vira travessão em vez de zero: "0 divergências"
  // e "não consegui carregar" são conclusões opostas.
  const vazio = carregando || erro || !resumo;
  const k = resumo?.kpis;

  return (
    <div className="dash-kpis">
      <Kpi
        titulo="Itens sem classificação"
        cor={CORES.pendentes}
        valor={vazio ? "—" : inteiro(k!.itens_sem_classificacao)}
        rodape={
          <>
            Travam o cálculo em{" "}
            <span className="num dash-kpi-rodape-num">{vazio ? "—" : k!.itens_sem_classificacao_empresas}</span> empresas
          </>
        }
      />
      <Kpi
        titulo="Divergências SEFAZ"
        cor={CORES.sefaz}
        valor={vazio ? "—" : inteiro(k!.divergencias_sefaz)}
        complemento={
          <span className="num dash-kpi-complemento">/ {vazio ? "—" : inteiro(k!.notas_comparadas)} notas</span>
        }
        rodape={
          <>
            Em <span className="num dash-kpi-rodape-num">{vazio ? "—" : k!.comparacoes}</span> comparações da competência
          </>
        }
      />
      <Kpi
        titulo="Competências não fechadas"
        cor={CORES.calculo}
        valor={vazio ? "—" : inteiro(k!.competencias_nao_fechadas)}
        complemento={
          <span className="num dash-kpi-complemento">de {vazio ? "—" : resumo!.empresas_no_escopo}</span>
        }
        rodape="Sem cálculo desde a importação do XML"
      />
      <Kpi
        titulo="Imposto apurado (R$)"
        cor={CORES.imposto}
        valor={vazio ? "—" : moedaSemPrefixo(k!.imposto_total)}
        valorCor={CORES.imposto}
        rodape={
          <span className="num dash-kpi-parcelas">
            <span>Fronteira {vazio ? "—" : moedaSemPrefixo(k!.imposto_fronteira)}</span>
            <span>Antecip. {vazio ? "—" : moedaSemPrefixo(k!.imposto_antecipacao)}</span>
          </span>
        }
      />
    </div>
  );
}
