/**
 * MOTOR DE INSIGHTS — spec §8.
 *
 * Regras determinísticas sobre o dataset, calibradas nos achados da spec §2.4.
 * Todas as métricas vêm da camada semântica (metrics.ts) — nada é recalculado aqui.
 */

import {
  calcular,
  calcularPorMes,
  mixRecebimento,
  moeda,
  nomeMes,
  percentual,
  ranking,
  slugDaEmpresa,
  slugDoEscopo,
  type Indice,
  type Metricas,
} from "./metrics";
import { rotuloEscopo } from "./escopo";
import type { Escopo } from "./types";

export type Severidade = "info" | "alerta" | "critico";

export interface Insight {
  id: string;
  /**
   * Chave ESTÁVEL do achado, usada para amarrar anotações no banco.
   *
   * Formada por `regra | slug do escopo | ano | mês | detalhe` — tudo
   * identidade, nada de rótulo. Não depende do nome da aba (que o contador
   * renomeia) nem do filtro de período ativo: a anotação é sobre o achado
   * ("fev/2026 foi ajuste de inventário"), não sobre a tela em que ele apareceu.
   */
  chave: string;
  regra: string;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  acao: string;
  empresa: string | null;
  mes: number | null;
}

const ORDEM: Record<Severidade, number> = { critico: 0, alerta: 1, info: 2 };

/** Identificadores curtos e imutáveis das regras — entram na chave gravada. */
const REGRA = {
  mesAnomalo: "mes-anomalo",
  deficitaria: "deficitaria-cronica",
  estruturaAtipica: "estrutura-atipica",
  erosaoMargem: "erosao-margem",
  concentracao: "concentracao-recebimento",
  pesoDeducoes: "peso-deducoes",
} as const;

function montarChave(partes: {
  regra: string;
  escopoSlug: string;
  ano: number;
  mes?: number | null;
  detalhe?: string | null;
}): string {
  return [
    partes.regra,
    partes.escopoSlug,
    partes.ano,
    partes.mes ?? "-",
    partes.detalhe ?? "-",
  ].join("|");
}

/** Limiares das regras — reunidos aqui para ficarem auditáveis. */
export const LIMIARES = {
  quedaLucroBruto: 0.4,
  mesesDeficitarios: 4,
  concentracaoRecebimento: 0.5,
  mesesErosaoMargem: 3,
  pesoDeducoes: 0.2,
};

function rotuloEscopoCurto(indice: Indice, escopo: Escopo): string {
  return rotuloEscopo(escopo, indice);
}

/** Regra 1 — mês anômalo: lucro bruto muito abaixo da média do período. */
function regraMesAnomalo(indice: Indice, escopo: Escopo, meses: number[]): Insight[] {
  const porMes = calcularPorMes(indice, escopo, meses);
  if (porMes.length < 3) return [];

  const serie = porMes.map((p) => p.metricas.lucroBruto);
  const media = serie.reduce((s, x) => s + x, 0) / serie.length;
  if (media <= 0) return [];

  const nome = rotuloEscopoCurto(indice, escopo);
  const escopoSlug = slugDoEscopo(indice, escopo);
  const ano = indice.dataset.meta.ano;
  return porMes
    .filter((p) => (media - p.metricas.lucroBruto) / media > LIMIARES.quedaLucroBruto)
    .map((p) => {
      const queda = (media - p.metricas.lucroBruto) / media;
      return {
        id: `mes-anomalo-${nome}-${p.mes}`,
        chave: montarChave({
          regra: REGRA.mesAnomalo,
          escopoSlug,
          ano,
          mes: p.mes,
        }),
        regra: "Mês anômalo",
        severidade: "alerta" as const,
        titulo: `${nomeMes(p.mes)}: lucro bruto ${percentual(queda, 0)} abaixo da média`,
        descricao:
          `Em ${nomeMes(p.mes)}, o lucro bruto de ${nome} foi de ${moeda(p.metricas.lucroBruto)} ` +
          `contra uma média de ${moeda(media)} no período. Queda dessa magnitude num único mês é ` +
          `assinatura típica de ajuste de estoque/inventário lançado no mês, não de perda de operação.`,
        acao: "Verificar com o contador se houve inventário ou ajuste de estoque no mês.",
        empresa: escopo.tipo === "empresa" ? escopo.codigo : null,
        mes: p.mes,
      };
    });
}

/**
 * Regra 2 — unidade cronicamente deficitária.
 *
 * Varre TODAS as unidades, inclusive o atacado: prejuízo recorrente é achado
 * válido em qualquer segmento. (Só a comparação entre segmentos é que não vale
 * — essa é a regra 3.)
 */
function regraDeficitaria(indice: Indice, meses: number[]): Insight[] {
  return indice.unidades.flatMap((codigo) => {
    const porMes = calcularPorMes(indice, { tipo: "empresa", codigo }, meses);
    const negativos = porMes.filter((p) => p.metricas.resultado < 0);
    if (negativos.length < LIMIARES.mesesDeficitarios) return [];

    const acumulado = calcular(indice, { tipo: "empresa", codigo }, meses);
    return [
      {
        id: `deficitaria-${codigo}`,
        chave: montarChave({
          regra: REGRA.deficitaria,
          escopoSlug: slugDaEmpresa(indice, codigo),
          ano: indice.dataset.meta.ano,
        }),
        regra: "Deficitária crônica",
        severidade: "critico" as const,
        titulo: `${codigo}: resultado negativo em ${negativos.length} de ${porMes.length} meses`,
        descricao:
          `${codigo} acumula ${moeda(acumulado.resultado)} de resultado no período, com margem ` +
          `líquida de ${percentual(acumulado.margemLiquida)}. O prejuízo é recorrente, não pontual — ` +
          `é um problema estrutural de operação, não um mês ruim.`,
        acao: "Revisar estrutura de custos e precificação da unidade; avaliar viabilidade.",
        empresa: codigo,
        mes: null,
      },
    ];
  });
}

/** Regra 3 — outlier de estrutura de custo (não-comparabilidade). */
function regraEstruturaAtipica(indice: Indice, meses: number[]): Insight[] {
  const { lojas } = ranking(indice, meses);
  return lojas
    .filter((linha) => linha.estruturaAtipica)
    .map((linha) => {
      const pares = lojas.filter((outra) => outra !== linha && outra.pesoDespesaOp !== null);
      const mediaPares =
        pares.reduce((s, p) => s + (p.pesoDespesaOp ?? 0), 0) / (pares.length || 1);
      const abaixo = (linha.pesoDespesaOp ?? 0) < mediaPares;
      return {
        id: `estrutura-atipica-${linha.codigo}`,
        chave: montarChave({
          regra: REGRA.estruturaAtipica,
          escopoSlug: slugDaEmpresa(indice, linha.codigo),
          ano: indice.dataset.meta.ano,
        }),
        regra: "Estrutura de custo atípica",
        severidade: "alerta" as const,
        titulo: `${linha.codigo}: despesa operacional ${abaixo ? "muito abaixo" : "muito acima"} dos pares`,
        descricao:
          `A despesa operacional de ${linha.codigo} representa ${percentual(linha.pesoDespesaOp)} ` +
          `da receita líquida, contra ${percentual(mediaPares)} na média das demais unidades de varejo. ` +
          `A diferença sugere alocação distinta de custos (por exemplo, folha centralizada em outra ` +
          `entidade) — comparar margens desta empresa com as demais leva a conclusão errada.`,
        acao: "Confirmar o critério de rateio antes de usar esta empresa em comparações de margem.",
        empresa: linha.codigo,
        mes: null,
      };
    });
}

/** Regra 4 — concentração de meio de recebimento. */
function regraConcentracaoRecebimento(
  indice: Indice,
  escopo: Escopo,
  meses: number[],
): Insight[] {
  const nome = rotuloEscopoCurto(indice, escopo);
  return mixRecebimento(indice, escopo, meses)
    .filter(
      (item) =>
        item.participacao !== null &&
        item.participacao > LIMIARES.concentracaoRecebimento,
    )
    .map((item) => ({
      id: `concentracao-${nome}-${item.classificacao}`,
      chave: montarChave({
        regra: REGRA.concentracao,
        escopoSlug: slugDoEscopo(indice, escopo),
        ano: indice.dataset.meta.ano,
        // a classificação da conta é estável; a descrição, não
        detalhe: item.classificacao,
      }),
      regra: "Concentração de recebimento",
      severidade: "info" as const,
      titulo: `${item.descricao} concentra ${percentual(item.participacao)} das vendas`,
      descricao:
        `Em ${nome}, ${item.descricao.toLowerCase()} responde por ${moeda(item.valor)} ` +
        `(${percentual(item.participacao)}) da venda de mercadorias no período. Concentração acima de ` +
        `50% num único meio expõe o caixa a custo de adquirência e a prazo de recebimento.`,
      acao: "Renegociar taxas de adquirência e avaliar impacto no capital de giro.",
      empresa: escopo.tipo === "empresa" ? escopo.codigo : null,
      mes: null,
    }));
}

/** Regra 5 — erosão de margem: queda em N meses consecutivos. */
function regraErosaoMargem(indice: Indice, escopo: Escopo, meses: number[]): Insight[] {
  const porMes = calcularPorMes(indice, escopo, meses);
  const margens = porMes.map((p) => ({ mes: p.mes, margem: p.metricas.margemBruta }));

  let sequencia: number[] = [];
  let maiorSequencia: number[] = [];
  for (let i = 1; i < margens.length; i++) {
    const atual = margens[i].margem;
    const anterior = margens[i - 1].margem;
    if (atual !== null && anterior !== null && atual < anterior) {
      sequencia = sequencia.length ? [...sequencia, margens[i].mes] : [margens[i - 1].mes, margens[i].mes];
      if (sequencia.length > maiorSequencia.length) maiorSequencia = sequencia;
    } else {
      sequencia = [];
    }
  }

  // "cai em N meses consecutivos" = N quedas ⇒ N+1 pontos na sequência
  if (maiorSequencia.length < LIMIARES.mesesErosaoMargem + 1) return [];

  const nome = rotuloEscopoCurto(indice, escopo);
  const primeiro = margens.find((m) => m.mes === maiorSequencia[0])!;
  const ultimo = margens.find((m) => m.mes === maiorSequencia[maiorSequencia.length - 1])!;
  return [
    {
      id: `erosao-margem-${nome}`,
      chave: montarChave({
        regra: REGRA.erosaoMargem,
        escopoSlug: slugDoEscopo(indice, escopo),
        ano: indice.dataset.meta.ano,
        mes: ultimo.mes,
      }),
      regra: "Erosão de margem",
      severidade: "alerta",
      titulo: `Margem bruta cai há ${maiorSequencia.length - 1} meses seguidos`,
      descricao:
        `Em ${nome}, a margem bruta recuou de ${percentual(primeiro.margem)} em ${nomeMes(primeiro.mes)} ` +
        `para ${percentual(ultimo.margem)} em ${nomeMes(ultimo.mes)}, sem interrupção. A tendência é ` +
        `consistente, não ruído mensal.`,
      acao: "Investigar preço de compra, mix de produtos e política de descontos.",
      empresa: escopo.tipo === "empresa" ? escopo.codigo : null,
      mes: ultimo.mes,
    },
  ];
}

/** Regra 6 — peso das deduções sobre a receita bruta. */
function regraPesoTributario(indice: Indice, escopo: Escopo, meses: number[]): Insight[] {
  const m: Metricas = calcular(indice, escopo, meses);
  if (m.pesoDeducoes === null || m.pesoDeducoes <= LIMIARES.pesoDeducoes) return [];

  const nome = rotuloEscopoCurto(indice, escopo);
  return [
    {
      id: `peso-deducoes-${nome}`,
      chave: montarChave({
        regra: REGRA.pesoDeducoes,
        escopoSlug: slugDoEscopo(indice, escopo),
        ano: indice.dataset.meta.ano,
      }),
      regra: "Peso das deduções",
      severidade: "info",
      titulo: `Deduções consomem ${percentual(m.pesoDeducoes)} da receita bruta`,
      descricao:
        `Em ${nome}, ${moeda(-m.deducoes)} da receita bruta de ${moeda(m.receitaBruta)} vão em ` +
        `impostos, cancelamentos e devoluções — acima do limite de referência de ` +
        `${percentual(LIMIARES.pesoDeducoes, 0)}.`,
      acao: "Revisar regime tributário e a parcela de cancelamentos/devoluções nas deduções.",
      empresa: escopo.tipo === "empresa" ? escopo.codigo : null,
      mes: null,
    },
  ];
}

/**
 * Gera todos os insights para o escopo e período ativos.
 * As regras 2 e 3 são estruturais (comparam empresas) e valem para qualquer
 * escopo — por isso entram sempre.
 */
export function gerarInsights(
  indice: Indice,
  escopo: Escopo,
  meses: number[],
): Insight[] {
  return [
    ...regraMesAnomalo(indice, escopo, meses),
    ...regraDeficitaria(indice, meses),
    ...regraEstruturaAtipica(indice, meses),
    ...regraErosaoMargem(indice, escopo, meses),
    ...regraConcentracaoRecebimento(indice, escopo, meses),
    ...regraPesoTributario(indice, escopo, meses),
  ].sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade]);
}
