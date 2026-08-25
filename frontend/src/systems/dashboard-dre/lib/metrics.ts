/**
 * CAMADA SEMÂNTICA — spec §6.
 *
 * 🔴 Este é o ÚNICO lugar onde métricas de DRE são calculadas. Nenhum componente
 * pode recalcular margem, lucro bruto ou resultado por conta própria.
 *
 * Convenção de sinal: deduções, custos e despesas já vêm NEGATIVOS do ETL —
 * as fórmulas somam, nunca subtraem.
 */

import type { Conta, Dataset, Escopo, Fato, Segmento } from "./types";

/** Classificações âncora da árvore de DRE. */
export const CONTAS = {
  resultado: "3",
  receitas: "3.1",
  receitaBruta: "3.1.01",
  vendaMercadorias: "3.1.01.01",
  deducoes: "3.1.02",
  outrasReceitasOp: "3.1.03",
  custos: "3.2",
  despesasOp: "3.3",
  despesasFin: "3.3.02.01",
  naoOperacional: "3.4",
} as const;

export const MESES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun"];

export function nomeMes(mes: number): string {
  return MESES_LABEL[mes - 1] ?? String(mes);
}

// --- Índice ----------------------------------------------------------------

export interface Indice {
  dataset: Dataset;
  /**
   * 🔴 Unidades por segmento. NENHUMA contém outra — a hierarquia entre abas
   * que existia aqui até ago/2026 era suposição tirada do nome da aba, e os
   * dados a desmentem (ver `etl/empresas.yaml`). Somar todas é correto.
   */
  varejo: string[];
  atacado: string[];
  /** todas as unidades com dados = varejo + atacado */
  unidades: string[];
  meses: number[];
  contasPorClassificacao: Map<string, Conta>;
  contasPorId: Map<number, Conta>;
  filhosDiretos: Map<string, Conta[]>;
  /** `${codigoEmpresa}|${contaId}|${mes}` → valor */
  valores: Map<string, number>;
}

function chave(empresa: string, contaId: number, mes: number): string {
  return `${empresa}|${contaId}|${mes}`;
}

export function indexar(dataset: Dataset): Indice {
  const empresaPorId = new Map(dataset.dim_empresa.map((e) => [e.id, e]));
  const contasPorId = new Map(dataset.dim_conta.map((c) => [c.id, c]));
  const contasPorClassificacao = new Map(
    dataset.dim_conta.map((c) => [c.classificacao, c]),
  );

  const filhosDiretos = new Map<string, Conta[]>();
  for (const conta of dataset.dim_conta) {
    const pai = conta.classificacao_pai;
    if (!pai) continue;
    const lista = filhosDiretos.get(pai);
    if (lista) lista.push(conta);
    else filhosDiretos.set(pai, [conta]);
  }

  const valores = new Map<string, number>();
  for (const fato of dataset.fato_dre as Fato[]) {
    const empresa = empresaPorId.get(fato.empresa_id);
    if (!empresa) continue;
    valores.set(chave(empresa.codigo, fato.conta_id, fato.periodo_id), fato.valor);
  }

  const comDados = dataset.dim_empresa.filter((e) => e.tem_dados);

  return {
    dataset,
    varejo: comDados.filter((e) => e.segmento === "varejo").map((e) => e.codigo),
    atacado: comDados.filter((e) => e.segmento === "atacado").map((e) => e.codigo),
    unidades: comDados.map((e) => e.codigo),
    meses: dataset.dim_periodo.map((p) => p.mes),
    contasPorClassificacao,
    contasPorId,
    filhosDiretos,
    valores,
  };
}

// --- Acesso a valores ------------------------------------------------------

/**
 * Slug estável do escopo — base das chaves de anotação de insight.
 *
 * `soma_lojas` e `grupo_total` são escopos sintéticos e têm slug próprio. Os
 * nomes internos `soma_lojas`/`soma-lojas` foram MANTIDOS na correção de
 * estrutura: mudar um slug em uso orfana anotações já gravadas, e o conjunto
 * que ele designa continua sendo "as unidades de varejo somadas" — só passou a
 * incluir a JNS VAR, que não era o consolidado que se supunha.
 */
export function slugDoEscopo(indice: Indice, escopo: Escopo): string {
  if (escopo.tipo === "soma_lojas") return "soma-lojas";
  if (escopo.tipo === "grupo_total") return "grupo-total";
  const empresa = indice.dataset.dim_empresa.find(
    (e) => e.codigo === escopo.codigo,
  );
  return empresa?.slug ?? escopo.codigo.toLowerCase().replace(/\s+/g, "-");
}

/** Slug estável de uma empresa a partir do código da aba. */
export function slugDaEmpresa(indice: Indice, codigo: string): string {
  return slugDoEscopo(indice, { tipo: "empresa", codigo });
}

/**
 * Unidades que compõem um escopo.
 *
 * 🔴 Como nenhuma unidade contém outra, somar é sempre seguro aqui:
 *   - `grupo_total`  todas as unidades com dados
 *   - `soma_lojas`   só as de varejo
 * O risco de dupla contagem que existia até ago/2026 vinha de uma hierarquia
 * entre abas que os dados não sustentam (ver `etl/empresas.yaml`).
 */
export function empresasDoEscopo(indice: Indice, escopo: Escopo): string[] {
  if (escopo.tipo === "soma_lojas") return indice.varejo;
  if (escopo.tipo === "grupo_total") return indice.unidades;
  return [escopo.codigo];
}

/** true se a unidade é do segmento de atacado. */
export function ehAtacado(indice: Indice, codigo: string): boolean {
  return indice.atacado.includes(codigo);
}

/** Valor de uma conta, num mês, para o escopo. */
export function valorMes(
  indice: Indice,
  escopo: Escopo,
  classificacao: string,
  mes: number,
): number {
  const conta = indice.contasPorClassificacao.get(classificacao);
  if (!conta) return 0;
  let total = 0;
  for (const empresa of empresasDoEscopo(indice, escopo)) {
    total += indice.valores.get(chave(empresa, conta.id, mes)) ?? 0;
  }
  return total;
}

/** Valor acumulado de uma conta no conjunto de meses selecionado. */
export function valor(
  indice: Indice,
  escopo: Escopo,
  classificacao: string,
  meses: number[],
): number {
  let total = 0;
  for (const mes of meses) total += valorMes(indice, escopo, classificacao, mes);
  return total;
}

/** Série mensal de uma conta (um ponto por mês selecionado). */
export function serie(
  indice: Indice,
  escopo: Escopo,
  classificacao: string,
  meses: number[],
): number[] {
  return meses.map((mes) => valorMes(indice, escopo, classificacao, mes));
}

// --- Fórmulas (spec §6) ----------------------------------------------------

/** 🔴 Denominador zero → null, nunca Infinity nem NaN. */
export function divSegura(
  numerador: number,
  denominador: number,
): number | null {
  if (!Number.isFinite(numerador) || !Number.isFinite(denominador)) return null;
  if (denominador === 0) return null;
  return numerador / denominador;
}

export interface Metricas {
  receitaBruta: number;
  deducoes: number;
  /** RL = Receita Bruta + Deduções (estrita: sem 3.1.03) */
  receitaLiquida: number;
  outrasReceitasOp: number;
  custos: number;
  lucroBruto: number;
  /** 3.3 completo (inclui as financeiras) */
  despesasOperacionais: number;
  despesasFinanceiras: number;
  /** 3.3 sem as financeiras — usado no waterfall para não contar duas vezes */
  despesasOperacionaisExFin: number;
  naoOperacional: number;
  resultadoOperacional: number;
  resultado: number;
  margemBruta: number | null;
  margemOperacional: number | null;
  margemLiquida: number | null;
  pesoDeducoes: number | null;
}

export function calcular(
  indice: Indice,
  escopo: Escopo,
  meses: number[],
): Metricas {
  const v = (c: string) => valor(indice, escopo, c, meses);

  const receitaBruta = v(CONTAS.receitaBruta);
  const deducoes = v(CONTAS.deducoes);
  const outrasReceitasOp = v(CONTAS.outrasReceitasOp);
  const custos = v(CONTAS.custos);
  const despesasOperacionais = v(CONTAS.despesasOp);
  const despesasFinanceiras = v(CONTAS.despesasFin);
  const naoOperacional = v(CONTAS.naoOperacional);

  const receitaLiquida = receitaBruta + deducoes;
  const lucroBruto = receitaLiquida + custos;
  const resultadoOperacional = lucroBruto + despesasOperacionais;
  const resultado = v(CONTAS.resultado);

  return {
    receitaBruta,
    deducoes,
    receitaLiquida,
    outrasReceitasOp,
    custos,
    lucroBruto,
    despesasOperacionais,
    despesasFinanceiras,
    // 🔴 separação proposital: financeiras são subconjunto de 3.3 (ver waterfall)
    despesasOperacionaisExFin: despesasOperacionais - despesasFinanceiras,
    naoOperacional,
    resultadoOperacional,
    resultado,
    margemBruta: divSegura(lucroBruto, receitaLiquida),
    margemOperacional: divSegura(resultadoOperacional, receitaLiquida),
    margemLiquida: divSegura(resultado, receitaLiquida),
    pesoDeducoes: divSegura(-deducoes, receitaBruta),
  };
}

/** Métricas mês a mês, para séries e sparklines. */
export function calcularPorMes(
  indice: Indice,
  escopo: Escopo,
  meses: number[],
): { mes: number; metricas: Metricas }[] {
  return meses.map((mes) => ({
    mes,
    metricas: calcular(indice, escopo, [mes]),
  }));
}

/** AV — análise vertical: conta / Receita Bruta Operacional (spec §6). */
export function analiseVertical(
  indice: Indice,
  escopo: Escopo,
  classificacao: string,
  meses: number[],
): number | null {
  return divSegura(
    valor(indice, escopo, classificacao, meses),
    valor(indice, escopo, CONTAS.receitaBruta, meses),
  );
}

/** AH — análise horizontal: (atual − anterior) / |anterior|. */
export function analiseHorizontal(
  atual: number,
  anterior: number,
): number | null {
  if (anterior === 0) return null;
  return (atual - anterior) / Math.abs(anterior);
}

/** Variação vs. a média dos demais meses do período. */
export function variacaoVsMedia(
  atual: number,
  serieCompleta: number[],
): number | null {
  if (serieCompleta.length === 0) return null;
  const media =
    serieCompleta.reduce((soma, x) => soma + x, 0) / serieCompleta.length;
  return analiseHorizontal(atual, media);
}

// --- Waterfall (spec §7.3) -------------------------------------------------

export interface DegrauWaterfall {
  chave: string;
  rotulo: string;
  valor: number;
  /** subtotal = barra ancorada no zero; fluxo = barra flutuante */
  tipo: "subtotal" | "fluxo";
  /** âncoras da barra no eixo de valor */
  inicio: number;
  fim: number;
}

/**
 * Degraus da cascata da DRE. A soma dos fluxos fecha exatamente no Resultado
 * (`3`), porque 3 = 3.1.01 + 3.1.02 + 3.1.03 + 3.2 + 3.3 + 3.4.
 */
export function waterfall(m: Metricas): DegrauWaterfall[] {
  const degraus: Omit<DegrauWaterfall, "inicio" | "fim">[] = [
    { chave: "receitaBruta", rotulo: "Receita bruta", valor: m.receitaBruta, tipo: "subtotal" },
    { chave: "deducoes", rotulo: "Deduções", valor: m.deducoes, tipo: "fluxo" },
    { chave: "receitaLiquida", rotulo: "Receita líquida", valor: m.receitaLiquida, tipo: "subtotal" },
    { chave: "custos", rotulo: "Custos / CMV", valor: m.custos, tipo: "fluxo" },
    { chave: "lucroBruto", rotulo: "Lucro bruto", valor: m.lucroBruto, tipo: "subtotal" },
    { chave: "outrasReceitasOp", rotulo: "Outras receitas op.", valor: m.outrasReceitasOp, tipo: "fluxo" },
    // 🔴 3.3 é quebrada de propósito em "operacionais sem financeiras" +
    // "financeiras (3.3.02.01)". As financeiras são SUBCONJUNTO de 3.3: somar os
    // dois degraus inteiros contaria a mesma despesa duas vezes e a cascata não
    // fecharia no resultado. A spec §7.3 pede os dois degraus separados — não
    // reunificar.
    { chave: "despesasOp", rotulo: "Despesas operacionais", valor: m.despesasOperacionaisExFin, tipo: "fluxo" },
    { chave: "despesasFin", rotulo: "Despesas financeiras", valor: m.despesasFinanceiras, tipo: "fluxo" },
    { chave: "naoOperacional", rotulo: "Não operacional", valor: m.naoOperacional, tipo: "fluxo" },
    { chave: "resultado", rotulo: "Resultado", valor: m.resultado, tipo: "subtotal" },
  ];

  // Âncoras de cada barra: subtotal parte do zero, fluxo flutua sobre o acumulado.
  let acumulado = 0;
  return degraus.map((degrau) => {
    const inicio = degrau.tipo === "subtotal" ? 0 : acumulado;
    const fim = degrau.tipo === "subtotal" ? degrau.valor : acumulado + degrau.valor;
    acumulado = fim;
    return { ...degrau, inicio, fim };
  });
}

// --- Composição (spec §7.6) ------------------------------------------------

export interface ItemComposicao {
  classificacao: string;
  descricao: string;
  tipo: "TT" | "NN";
  valor: number;
  /** participação no total do conjunto (0–1) ou null se o total for zero */
  participacao: number | null;
  temFilhos: boolean;
}

/** Filhos diretos de uma conta, na ordem da árvore. */
export function filhosDe(indice: Indice, classificacao: string) {
  return indice.filhosDiretos.get(classificacao) ?? [];
}

/**
 * Decompõe uma conta nos seus filhos diretos, com participação relativa.
 * Itens zerados no período são omitidos (não poluem o gráfico).
 */
export function composicao(
  indice: Indice,
  escopo: Escopo,
  classificacaoPai: string,
  meses: number[],
  { removerPrefixo = "" }: { removerPrefixo?: string } = {},
): ItemComposicao[] {
  const itens = filhosDe(indice, classificacaoPai)
    .map((conta) => ({
      classificacao: conta.classificacao,
      descricao: removerPrefixo
        ? conta.descricao.replace(removerPrefixo, "").trim()
        : conta.descricao,
      tipo: conta.tipo,
      valor: valor(indice, escopo, conta.classificacao, meses),
      temFilhos: filhosDe(indice, conta.classificacao).length > 0,
    }))
    .filter((item) => item.valor !== 0);

  const total = itens.reduce((soma, item) => soma + item.valor, 0);
  return itens
    .map((item) => ({ ...item, participacao: divSegura(item.valor, total) }))
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
}

/** Mix de recebimento: meios de pagamento da venda de mercadorias. */
export function mixRecebimento(
  indice: Indice,
  escopo: Escopo,
  meses: number[],
): ItemComposicao[] {
  return composicao(indice, escopo, CONTAS.vendaMercadorias, meses, {
    removerPrefixo: "Venda de Mercadorias -",
  });
}

/**
 * Quebra de despesas operacionais: subgrupos de administrativas/comerciais
 * (3.3.01.xx) e de outras despesas operacionais (3.3.02.xx), juntos.
 */
export function quebraDespesas(
  indice: Indice,
  escopo: Escopo,
  meses: number[],
): ItemComposicao[] {
  const itens = [
    ...filhosDe(indice, "3.3.01"),
    ...filhosDe(indice, "3.3.02"),
  ]
    .map((conta) => ({
      classificacao: conta.classificacao,
      descricao: conta.descricao,
      tipo: conta.tipo,
      valor: valor(indice, escopo, conta.classificacao, meses),
      temFilhos: filhosDe(indice, conta.classificacao).length > 0,
    }))
    .filter((item) => item.valor !== 0);

  const total = itens.reduce((soma, item) => soma + item.valor, 0);
  return itens
    .map((item) => ({ ...item, participacao: divSegura(item.valor, total) }))
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
}

// --- Comparativo entre empresas (spec §7.5) --------------------------------

export interface LinhaRanking {
  codigo: string;
  segmento: Segmento;
  metricas: Metricas;
  /** Desp. operacionais / RL — usado para sinalizar não-comparabilidade */
  pesoDespesaOp: number | null;
  /** true quando o peso é outlier vs. os pares (±1,5·IQR) */
  estruturaAtipica: boolean;
}

function quartil(valoresOrdenados: number[], q: number): number {
  const posicao = (valoresOrdenados.length - 1) * q;
  const base = Math.floor(posicao);
  const resto = posicao - base;
  const proximo = valoresOrdenados[base + 1];
  return proximo === undefined
    ? valoresOrdenados[base]
    : valoresOrdenados[base] + resto * (proximo - valoresOrdenados[base]);
}

/**
 * Ranking das unidades de varejo.
 *
 * 🔴 O atacado fica FORA da lista — não por dupla contagem (nenhuma unidade
 * contém outra), mas por não ser comparável: ele vende só por convênio, sem
 * dinheiro, cartão nem PIX. Ranquear os dois juntos compara negócios
 * diferentes. Volta à parte, como referência de tamanho.
 */
export function ranking(
  indice: Indice,
  meses: number[],
): { lojas: LinhaRanking[]; grupos: LinhaRanking[] } {
  const linha = (codigo: string, segmento: Segmento): LinhaRanking => {
    const metricas = calcular(indice, { tipo: "empresa", codigo }, meses);
    return {
      codigo,
      segmento,
      metricas,
      pesoDespesaOp: divSegura(
        -metricas.despesasOperacionais,
        metricas.receitaLiquida,
      ),
      estruturaAtipica: false,
    };
  };

  const lojas = indice.varejo.map((codigo) => linha(codigo, "varejo"));

  // Outlier de estrutura de custo (spec §8, regra 3): fora de ±1,5·IQR dos
  // PARES. Com poucas empresas, incluir a própria candidata no cálculo do IQR
  // mascara o outlier — por isso as cercas são leave-one-out.
  for (const loja of lojas) {
    if (loja.pesoDespesaOp === null) continue;
    const pares = lojas
      .filter((outra) => outra !== loja)
      .map((outra) => outra.pesoDespesaOp)
      .filter((p): p is number => p !== null)
      .sort((a, b) => a - b);
    if (pares.length < 3) continue;
    const q1 = quartil(pares, 0.25);
    const q3 = quartil(pares, 0.75);
    const iqr = q3 - q1;
    loja.estruturaAtipica =
      loja.pesoDespesaOp < q1 - 1.5 * iqr || loja.pesoDespesaOp > q3 + 1.5 * iqr;
  }

  // O atacado vai à parte: não é comparável com varejo (ver acima).
  const grupos = indice.atacado.map((codigo) => linha(codigo, "atacado"));

  return { lojas, grupos };
}

// --- Detecção de mês anômalo (spec §8, regra 1) ----------------------------

/**
 * Meses cujo lucro bruto cai mais que `quedaMinima` abaixo da média do período.
 * Versão mínima usada para destacar a banda nas tendências; o motor completo de
 * insights chega na Fase 3.
 */
export function mesesAnomalos(
  porMes: { mes: number; metricas: Metricas }[],
  quedaMinima = 0.4,
): number[] {
  if (porMes.length < 3) return [];
  const serieLb = porMes.map((p) => p.metricas.lucroBruto);
  const media = serieLb.reduce((s, x) => s + x, 0) / serieLb.length;
  if (media <= 0) return [];
  return porMes
    .filter((p) => (media - p.metricas.lucroBruto) / media > quedaMinima)
    .map((p) => p.mes);
}

// --- Formatação ------------------------------------------------------------

const FMT_MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const FMT_COMPACTO = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function moeda(valor: number): string {
  return FMT_MOEDA.format(valor);
}

/**
 * Moeda com sinal de menos tipográfico (U+2212) no lugar do hífen — apresentação
 * apenas, para as subtrações da cascata lerem como subtração.
 */
export function moedaComMenos(valor: number): string {
  return FMT_MOEDA.format(valor).replace("-", "−");
}

export function moedaCompacta(valor: number): string {
  return `R$ ${FMT_COMPACTO.format(valor)}`;
}

/** Percentual; `null` (denominador zero) vira travessão. */
export function percentual(x: number | null, casas = 1): string {
  if (x === null || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(casas).replace(".", ",")}%`;
}

export function percentualComSinal(x: number | null, casas = 1): string {
  if (x === null || !Number.isFinite(x)) return "—";
  const sinal = x > 0 ? "+" : "";
  return `${sinal}${(x * 100).toFixed(casas).replace(".", ",")}%`;
}
