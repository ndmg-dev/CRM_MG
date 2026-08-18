// Tipos e interfaces
export interface TabelaINSS {
  faixaInicial: number;
  faixaFinal: number;
  aliquota: number;
}

export interface TabelaIRRF {
  faixaInicial: number;
  faixaFinal: number;
  aliquota: number;
  parcelaDedutivel: number;
}

export interface ConfigTributavel {
  saldo: boolean;
  decimoTerceiro: boolean;
  avisoIndenizado: boolean;
  feriasIndenizadas: boolean;
}

export interface ProventoExtra {
  descricao: string;
  valor: number;
  incideDecimoTerceiro: boolean;
  incideFerias: boolean;
}

export interface Insalubridade {
  valorBase: number;
  percentual: 10 | 20 | 40 | 0;
  incideDecimoTerceiro: boolean;
  incideFerias: boolean;
}

export interface Periculosidade {
  ativo: boolean;
  valorBase: number;
  incideDecimoTerceiro: boolean;
  incideFerias: boolean;
}

export interface DadosRescisao {
  empresa: string;
  cnpj: string;
  colaborador: string;
  cpf: string;
  salarioBruto: number;
  dataAdmissao: Date | null;
  mesAnoRescisao: Date;
  diasTrabalhados: number;
  /** true = divide por 30 (mês comercial); false/undefined = divide pelos dias reais do mês */
  usar30DiasParaSaldo?: boolean;
  anosEmpresa: number;
  tipoDesligamento: 'sem_justa_causa' | 'acordo' | 'pedido_demissao' | 'justa_causa' | 'fgts_8' | 'nao_aplicavel';
  tipoAviso: 'indenizado' | 'trabalhado' | 'nao_aplicavel';
  mesesPeriodoAquisitivo: number;
  feriasVencidas: boolean;
  periodosFeriasVencidas: number;
  mesesAno: number;
  saldoFGTS: number;
  faltas: number;
  outrosDescontos: { descricao: string; valor: number }[];
  demissaoAvulsa: boolean;
  incluirINSS: boolean;
  incluirIRRF: boolean;
  proventosExtras: ProventoExtra[];
  insalubridade: Insalubridade;
  periculosidade: Periculosidade;
  salariosPorAno: Record<number, number>;
  usarApenasUltimoSalario: boolean;
  decimoTerceiroPago: Record<number, boolean>;
  mesesPorAno: Record<number, number>;
  periodosPagos: Record<string, boolean>;
  incluirFGTS?: boolean;
  fgtsOverrides?: Record<string, { incluido?: boolean; valor?: number }>;
}

export interface FGTSCompetencia {
  competencia: string; // "01/2024", "13º/2024"
  tipo: 'mensal' | '13º';
  base: number;
  percentual: number;
  valor: number;
  incluido: boolean;
  valorOriginal: number;
}

export interface FGTSAnual {
  ano: number;
  competencias: FGTSCompetencia[];
  subtotal: number;
}

export interface MemoriaCalculo {
  descricao: string;
  formula: string;
  substituicao: string;
  resultado: number;
}

export interface ResultadoCalculo {
  saldoSalario: number;
  avisoIndenizado: number;
  feriasProporcionais: number;
  tercoFerias: number;
  feriasVencidas: number;
  tercoFeriasVencidas: number;
  decimoTerceiro: number;
  decimoTerceiroPorAno: { ano: number; avos: number; valor: number }[];
  saldoFGTS: number;
  multaFGTS: number;
  proventosExtrasTotal: number;
  insalubridadeValor: number;
  periculosidadeValor: number;
  reflexoProvento13: number;
  reflexoProventoFeriasProp: number;
  reflexoProventoTercoFeriasProp: number;
  reflexoProventoFeriasVenc: number;
  reflexoProventoTercoFeriasVenc: number;
  bruto: number;
  baseINSS: number;
  inss: number;
  detalheINSS: { faixa: string; base: number; aliquota: number; valor: number }[];
  baseIRRF: number;
  irrf: number;
  detalheIRRF: { descricao: string; valor: number }[];
  descontosLegais: number;
  outrosDescontosTotal: number;
  liquido: number;
  memorias: MemoriaCalculo[];
  fgtsDetalhado: FGTSAnual[];
}

// Tabelas padrão INSS 2026 (progressivo)
export const TABELA_INSS_PADRAO: TabelaINSS[] = [
  { faixaInicial: 0, faixaFinal: 1621.00, aliquota: 7.5 },
  { faixaInicial: 1621.01, faixaFinal: 2902.84, aliquota: 9 },
  { faixaInicial: 2902.85, faixaFinal: 4354.27, aliquota: 12 },
  { faixaInicial: 4354.28, faixaFinal: 8475.55, aliquota: 14 },
];

// Tabela padrão IRRF 2026 (mensal)
export const TABELA_IRRF_PADRAO: TabelaIRRF[] = [
  { faixaInicial: 0, faixaFinal: 2428.80, aliquota: 0, parcelaDedutivel: 0 },
  { faixaInicial: 2428.81, faixaFinal: 2826.65, aliquota: 7.5, parcelaDedutivel: 182.16 },
  { faixaInicial: 2826.66, faixaFinal: 3751.05, aliquota: 15, parcelaDedutivel: 394.16 },
  { faixaInicial: 3751.06, faixaFinal: 4664.68, aliquota: 22.5, parcelaDedutivel: 675.49 },
  { faixaInicial: 4664.69, faixaFinal: Infinity, aliquota: 27.5, parcelaDedutivel: 908.73 },
];

export const CONFIG_TRIBUTAVEL_PADRAO: ConfigTributavel = {
  saldo: true,
  decimoTerceiro: true,
  avisoIndenizado: true,
  feriasIndenizadas: true,
};

// Classe de erro para validações de saldo de salário
export class ValidacaoSaldoSalarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidacaoSaldoSalarioError';
  }
}

/**
 * Verifica se um ano é bissexto.
 * Regras:
 * - Divisível por 400 → bissexto
 * - Divisível por 100 (mas não por 400) → não bissexto
 * - Divisível por 4 (mas não por 100) → bissexto
 * - Caso contrário → não bissexto
 */
export function isBissexto(ano: number): boolean {
  if (ano % 400 === 0) return true;
  if (ano % 100 === 0) return false;
  return ano % 4 === 0;
}

/**
 * Retorna o número real de dias de um mês (28-31).
 * @param ano - Ano da competência (ex: 2025)
 * @param mes - Mês da competência (1-12)
 * @throws Error se mês estiver fora do intervalo 1-12
 */
export function diasNoMes(ano: number, mes: number): number {
  if (mes < 1 || mes > 12) {
    throw new Error('Mês inválido: deve estar entre 1 e 12');
  }
  
  // Meses com 31 dias: Janeiro, Março, Maio, Julho, Agosto, Outubro, Dezembro
  if ([1, 3, 5, 7, 8, 10, 12].includes(mes)) return 31;
  
  // Meses com 30 dias: Abril, Junho, Setembro, Novembro
  if ([4, 6, 9, 11].includes(mes)) return 30;
  
  // Fevereiro: 28 ou 29 conforme ano bissexto
  return isBissexto(ano) ? 29 : 28;
}

/**
 * Calcula o saldo de salário usando DIAS REAIS do mês.
 * 
 * Fórmula: saldo_salario = salario_mensal * (dias_trabalhados / dias_do_mes)
 * 
 * IMPORTANTE: Esta função NÃO usa divisor 30 (mês comercial).
 * Para fevereiro, usa 28 ou 29 dias conforme ano bissexto.
 * 
 * @param salarioMensal - Valor mensal fixo (deve ser > 0)
 * @param competenciaAno - Ano da competência (1900-2100)
 * @param competenciaMes - Mês da competência (1-12)
 * @param diasTrabalhados - Dias efetivamente trabalhados (>= 0, <= dias do mês)
 * @returns Saldo de salário arredondado para 2 casas decimais
 * @throws ValidacaoSaldoSalarioError para entradas inválidas
 */
export function calcularSaldoSalarioDiasReais(
  salarioMensal: number,
  competenciaAno: number,
  competenciaMes: number,
  diasTrabalhados: number
): number {
  // Validações
  if (salarioMensal <= 0) {
    throw new ValidacaoSaldoSalarioError('salario_mensal deve ser maior que 0');
  }
  
  if (competenciaAno < 1900 || competenciaAno > 2100) {
    throw new ValidacaoSaldoSalarioError('competencia_ano deve estar entre 1900 e 2100');
  }
  
  if (diasTrabalhados < 0) {
    throw new ValidacaoSaldoSalarioError('dias_trabalhados deve ser >= 0');
  }
  
  // diasNoMes já valida o mês
  const diasDoMes = diasNoMes(competenciaAno, competenciaMes);
  
  if (diasTrabalhados > diasDoMes) {
    throw new ValidacaoSaldoSalarioError(
      `dias_trabalhados não pode exceder dias do mês (${diasTrabalhados} > ${diasDoMes})`
    );
  }
  
  // Fórmula canônica: saldo = salario * (dias_trabalhados / dias_do_mes)
  const saldo = salarioMensal * (diasTrabalhados / diasDoMes);
  
  // Arredondar para 2 casas decimais (half-up)
  return Math.round(saldo * 100) / 100;
}

// Funções de cálculo puras (legado - mantido para compatibilidade)

/**
 * @deprecated Use calcularSaldoSalarioDiasReais para cálculo com dias reais do mês.
 * Esta função usa divisor fixo 30 (mês comercial).
 */
export function calcularValorDiario(salario: number): number {
  return salario / 30;
}

/**
 * @deprecated Use calcularSaldoSalarioDiasReais para cálculo com dias reais do mês.
 * Esta função usa divisor fixo 30 (mês comercial).
 */
export function calcularSaldoSalario(salario: number, dias: number): number {
  return calcularValorDiario(salario) * dias;
}

export function calcularDiasAviso(anos: number): number {
  const dias = 30 + (3 * anos);
  return Math.min(dias, 90);
}

export function calcularAvisoIndenizado(salario: number, anos: number): number {
  const dias = calcularDiasAviso(anos);
  return calcularValorDiario(salario) * dias;
}

export function calcularFeriasProporcionais(salario: number, meses: number): number {
  return (salario / 12) * meses;
}

export function calcularTercoFerias(valorFerias: number): number {
  return valorFerias / 3;
}

export function calcularFeriasVencidas(salario: number, periodos: number): number {
  return periodos * salario;
}

export function calcularDecimoTerceiro(salario: number, meses: number): number {
  return (salario / 12) * meses;
}

export function calcularMultaFGTS(
  saldoFGTS: number, 
  tipoDesligamento: 'sem_justa_causa' | 'acordo' | 'pedido_demissao' | 'justa_causa' | 'fgts_8' | 'nao_aplicavel'
): number {
  if (tipoDesligamento === 'sem_justa_causa') {
    return saldoFGTS * 0.40;
  }
  if (tipoDesligamento === 'acordo') {
    return saldoFGTS * 0.20;
  }
  // FGTS 8%, justa causa, pedido de demissão e "não aplicável" não têm multa
  return 0;
}

// Cálculo progressivo do INSS
export function calcularINSSProgressivo(
  base: number, 
  tabela: TabelaINSS[]
): { total: number; detalhes: { faixa: string; base: number; aliquota: number; valor: number }[] } {
  const detalhes: { faixa: string; base: number; aliquota: number; valor: number }[] = [];
  let total = 0;
  let baseRestante = base;
  
  // Teto de contribuição
  const teto = tabela[tabela.length - 1]?.faixaFinal || 8475.55;
  if (baseRestante > teto) {
    baseRestante = teto;
  }
  
  for (let i = 0; i < tabela.length && baseRestante > 0; i++) {
    const faixa = tabela[i];
    const faixaInferior = i === 0 ? 0 : tabela[i - 1].faixaFinal;
    const faixaSuperior = faixa.faixaFinal;
    const amplitude = faixaSuperior - faixaInferior;
    
    const baseNaFaixa = Math.min(baseRestante, amplitude);
    const valorFaixa = baseNaFaixa * (faixa.aliquota / 100);
    
    if (baseNaFaixa > 0) {
      detalhes.push({
        faixa: `R$ ${formatarMoeda(faixaInferior)} a R$ ${formatarMoeda(faixaSuperior)}`,
        base: baseNaFaixa,
        aliquota: faixa.aliquota,
        valor: valorFaixa,
      });
    }
    
    total += valorFaixa;
    baseRestante -= baseNaFaixa;
  }
  
  return { total, detalhes };
}

// Cálculo do IRRF
export function calcularIRRF(
  base: number,
  tabela: TabelaIRRF[],
  aplicarRedutor: boolean = false,
  dependentes: number = 0,
  descontoSimplificado: number = 0
): { total: number; detalhes: { descricao: string; valor: number }[] } {
  const detalhes: { descricao: string; valor: number }[] = [];
  
  // Dedução por dependente (valor 2026)
  const deducaoPorDependente = 189.59;
  const deducaoDependentes = dependentes * deducaoPorDependente;
  
  let baseCalculo = base;
  
  // Aplicar desconto simplificado ou dedução dependentes (o maior)
  const deducaoAplicar = Math.max(descontoSimplificado, deducaoDependentes);
  baseCalculo -= deducaoAplicar;
  
  if (deducaoAplicar > 0) {
    detalhes.push({ 
      descricao: `Dedução aplicada (${descontoSimplificado > deducaoDependentes ? 'simplificada' : dependentes + ' dependentes'})`,
      valor: -deducaoAplicar 
    });
  }
  
  detalhes.push({ descricao: 'Base de cálculo IRRF', valor: baseCalculo });
  
  // Encontrar a faixa aplicável
  const faixa = tabela.find(f => baseCalculo >= f.faixaInicial && baseCalculo <= f.faixaFinal);
  
  if (!faixa || faixa.aliquota === 0) {
    detalhes.push({ descricao: 'IRRF (isento)', valor: 0 });
    return { total: 0, detalhes };
  }
  
  let irCalculado = (baseCalculo * faixa.aliquota / 100) - faixa.parcelaDedutivel;
  
  detalhes.push({ 
    descricao: `Alíquota ${faixa.aliquota}% - Parcela dedutível R$ ${formatarMoeda(faixa.parcelaDedutivel)}`,
    valor: irCalculado 
  });
  
  // Aplicar redutor mensal 2026 se habilitado
  if (aplicarRedutor && base <= 7350) {
    let redutor = 0;
    
    if (base <= 5000) {
      // Redutor máximo para zerar IR
      redutor = Math.min(irCalculado, 312.89);
    } else {
      // Redução decrescente linear
      redutor = 978.62 - (0.133145 * base);
      redutor = Math.max(0, Math.min(redutor, irCalculado));
    }
    
    if (redutor > 0) {
      detalhes.push({ descricao: 'Redutor Mensal 2026', valor: -redutor });
      irCalculado -= redutor;
    }
  }
  
  const total = Math.max(0, irCalculado);
  detalhes.push({ descricao: 'IRRF a recolher', valor: total });
  
  return { total, detalhes };
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseMoeda(texto: string): number {
  if (!texto) return 0;
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(limpo) || 0;
}

// Cálculo completo da rescisão
export function calcularRescisao(
  dados: DadosRescisao,
  tabelaINSS: TabelaINSS[],
  tabelaIRRF: TabelaIRRF[],
  configTributavel: ConfigTributavel,
  aplicarRedutor: boolean = false,
  dependentes: number = 0,
  descontoSimplificado: number = 0,
  incluirINSS: boolean = true,
  incluirIRRF: boolean = true
): ResultadoCalculo {
  const memorias: MemoriaCalculo[] = [];
  
  // Obter mês e ano da competência (data de rescisão)
  const competenciaAno = dados.mesAnoRescisao.getFullYear();
  const competenciaMes = dados.mesAnoRescisao.getMonth() + 1; // getMonth() retorna 0-11
  const diasDoMes = diasNoMes(competenciaAno, competenciaMes);

  // Divisor do saldo de salário: dias reais do mês (padrão) ou 30 (mês comercial)
  const divisorSaldo = dados.usar30DiasParaSaldo ? 30 : diasDoMes;

  // Valor diário
  const valorDiario = dados.salarioBruto / divisorSaldo;
  memorias.push({
    descricao: 'Valor diário',
    formula: dados.usar30DiasParaSaldo
      ? 'Salário ÷ 30 (mês comercial)'
      : `Salário ÷ Dias do mês (${diasDoMes} dias em ${competenciaMes}/${competenciaAno})`,
    substituicao: `R$ ${formatarMoeda(dados.salarioBruto)} ÷ ${divisorSaldo}`,
    resultado: valorDiario,
  });

  // Saldo de salário
  // Limitar dias trabalhados ao máximo do divisor para evitar erro
  const diasTrabalhadosValidados = Math.min(dados.diasTrabalhados, divisorSaldo);
  const saldoSalario = dados.salarioBruto * (diasTrabalhadosValidados / divisorSaldo);
  memorias.push({
    descricao: 'Saldo de salário',
    formula: dados.usar30DiasParaSaldo
      ? 'Salário × (Dias trabalhados ÷ 30)'
      : 'Salário × (Dias trabalhados ÷ Dias do mês)',
    substituicao: `R$ ${formatarMoeda(dados.salarioBruto)} × (${diasTrabalhadosValidados} ÷ ${divisorSaldo})`,
    resultado: saldoSalario,
  });
  
  // Aviso prévio indenizado (FGTS 8% se comporta como sem_justa_causa)
  let avisoIndenizado = 0;
  const tipoParaCalculo =
    dados.tipoDesligamento === 'fgts_8'
      ? 'sem_justa_causa'
      : dados.tipoDesligamento === 'nao_aplicavel'
        ? 'justa_causa'
        : dados.tipoDesligamento;
  if (dados.tipoAviso === 'indenizado' && tipoParaCalculo !== 'justa_causa') {
    const diasAviso = calcularDiasAviso(dados.anosEmpresa);
    avisoIndenizado = calcularAvisoIndenizado(dados.salarioBruto, dados.anosEmpresa);
    memorias.push({
      descricao: 'Aviso prévio indenizado',
      formula: 'Valor diário × min(30 + 3×anos, 90)',
      substituicao: `R$ ${formatarMoeda(valorDiario)} × ${diasAviso} dias`,
      resultado: avisoIndenizado,
    });
  }
  
  // Projeção do aviso indenizado: adiciona 1/12 avos de férias e 13º
  const avisoIndenizadoAtivo = avisoIndenizado > 0;
  const projecaoAviso = avisoIndenizadoAtivo ? 1 : 0;
  
  // Helper para obter salário de um ano específico
  const getSalarioAno = (ano: number) => dados.usarApenasUltimoSalario ? dados.salarioBruto : (dados.salariosPorAno?.[ano] || dados.salarioBruto);
  const salarioAtual = getSalarioAno(competenciaAno);
  
  // Férias proporcionais (usa salário do ano da rescisão)
  let feriasProporcionais = 0;
  let tercoFerias = 0;
  const mesesFeriasComProjecao = Math.min(dados.mesesPeriodoAquisitivo + projecaoAviso, 12);
  if (tipoParaCalculo !== 'justa_causa' && mesesFeriasComProjecao > 0) {
    feriasProporcionais = calcularFeriasProporcionais(salarioAtual, mesesFeriasComProjecao);
    tercoFerias = calcularTercoFerias(feriasProporcionais);
    const projecaoTexto = avisoIndenizadoAtivo ? ` (${dados.mesesPeriodoAquisitivo} + 1 projeção aviso)` : '';
    memorias.push({
      descricao: 'Férias proporcionais + 1/3',
      formula: '(Salário ÷ 12) × Meses + 1/3',
      substituicao: `(R$ ${formatarMoeda(salarioAtual)} ÷ 12) × ${mesesFeriasComProjecao}${projecaoTexto} + R$ ${formatarMoeda(tercoFerias)}`,
      resultado: feriasProporcionais + tercoFerias,
    });
  }
  
  // Férias vencidas (usa salário do ano da rescisão)
  let feriasVencidas = 0;
  let tercoFeriasVencidas = 0;
  if (dados.feriasVencidas && dados.periodosFeriasVencidas > 0) {
    feriasVencidas = calcularFeriasVencidas(salarioAtual, dados.periodosFeriasVencidas);
    tercoFeriasVencidas = calcularTercoFerias(feriasVencidas);
    memorias.push({
      descricao: 'Férias vencidas + 1/3',
      formula: 'Períodos × (Salário + 1/3)',
      substituicao: `${dados.periodosFeriasVencidas} × (R$ ${formatarMoeda(salarioAtual)} + R$ ${formatarMoeda(tercoFeriasVencidas)})`,
      resultado: feriasVencidas + tercoFeriasVencidas,
    });
  }
  
  // 13º salário - cálculo por ano
  let decimoTerceiro = 0;
  const decimoTerceiroPorAno: { ano: number; avos: number; valor: number }[] = [];
  const mesesPorAno = dados.mesesPorAno || {};
  const meses13SemProjecao = dados.mesesAno;
  const meses13ComProjecao = dados.mesesAno + projecaoAviso;
  if (tipoParaCalculo !== 'justa_causa') {
    const anosCalc: string[] = [];
    for (const [anoStr, meses] of Object.entries(mesesPorAno)) {
      const ano = parseInt(anoStr);
      if (dados.decimoTerceiroPago?.[ano]) continue;
      const mesesCalc = meses;
      const sal = getSalarioAno(ano);
      const valor13Ano = (sal / 12) * mesesCalc;
      decimoTerceiro += valor13Ano;
      decimoTerceiroPorAno.push({ ano, avos: mesesCalc, valor: valor13Ano });
      anosCalc.push(`${ano}: (R$ ${formatarMoeda(sal)} ÷ 12) × ${mesesCalc}`);
    }
    // Fallback: se não há mesesPorAno, usar cálculo tradicional
    if (Object.keys(mesesPorAno).length === 0 && meses13SemProjecao > 0) {
      decimoTerceiro = calcularDecimoTerceiro(dados.salarioBruto, meses13SemProjecao);
      decimoTerceiroPorAno.push({ ano: competenciaAno, avos: meses13SemProjecao, valor: decimoTerceiro });
      anosCalc.push(`(R$ ${formatarMoeda(dados.salarioBruto)} ÷ 12) × ${meses13SemProjecao}`);
    }
    if (decimoTerceiro > 0) {
      memorias.push({
        descricao: '13º salário proporcional',
        formula: 'Soma por ano: (Salário do ano ÷ 12) × Meses',
        substituicao: anosCalc.join(' | '),
        resultado: decimoTerceiro,
      });
    }
  }
  
  // FGTS - cálculo por competência: 8% sobre cada competência mensal + 13º
  let saldoFGTSCalculado = 0;
  const fgtsDetalhado: FGTSAnual[] = [];
  const incluirFGTSGeral = dados.incluirFGTS !== false;
  const fgtsOverrides = dados.fgtsOverrides || {};
  const aplicarOverride = (comp: FGTSCompetencia): FGTSCompetencia => {
    const ov = fgtsOverrides[comp.competencia];
    const incluido = incluirFGTSGeral && (ov?.incluido !== false);
    const valor = ov?.valor !== undefined ? Math.round(ov.valor * 100) / 100 : comp.valor;
    return { ...comp, incluido, valor };
  };
  
  if (dados.dataAdmissao) {
    const admissao = dados.dataAdmissao instanceof Date ? dados.dataAdmissao : new Date(dados.dataAdmissao);
    const rescisao = dados.mesAnoRescisao instanceof Date ? dados.mesAnoRescisao : new Date(dados.mesAnoRescisao);
    const anoInicio = admissao.getFullYear();
    const mesInicio = admissao.getMonth(); // 0-based
    const anoFim = rescisao.getFullYear();
    const mesFim = rescisao.getMonth(); // 0-based
    const diaFim = rescisao.getDate();
    
    for (let ano = anoInicio; ano <= anoFim; ano++) {
      const competencias: FGTSCompetencia[] = [];
      let subtotalAno = 0;
      const salAno = getSalarioAno(ano);
      
      const mesStart = ano === anoInicio ? mesInicio : 0;
      const mesEnd = ano === anoFim ? mesFim : 11;
      
      let mesesTrabalhadosNoAno = 0;
      
      for (let mes = mesStart; mes <= mesEnd; mes++) {
        let base: number;
        const diasDoMesAtual = diasNoMes(ano, mes + 1);
        const isMesAdmissao = ano === anoInicio && mes === mesInicio;
        const isMesDemissao = ano === anoFim && mes === mesFim;
        const diasTrabMes = isMesDemissao
          ? dados.diasTrabalhados
          : isMesAdmissao
            ? diasDoMesAtual - admissao.getDate() + 1
            : diasDoMesAtual;
        // FGTS incide sobre toda remuneração paga (Lei 8.036/90 art. 15),
        // inclusive em meses parciais de admissão/demissão. O usuário pode
        // desmarcar a competência manualmente caso queira excluí-la.
        if (diasTrabMes <= 0) {
          continue;
        }
        
        // Verificar se é o mês da demissão (último mês)
        if (isMesDemissao) {
          // Competência da demissão: proporcional aos dias trabalhados
          base = Math.round((salAno / diasDoMesAtual) * diasTrabMes * 100) / 100;
        } else if (isMesAdmissao) {
          // Primeiro mês: proporcional aos dias a partir da admissão até o fim do mês
          base = Math.round((salAno / diasDoMesAtual) * diasTrabMes * 100) / 100;
        } else {
          base = salAno;
        }
        
        const valor = Math.round(base * 0.08 * 100) / 100;
        const mesLabel = String(mes + 1).padStart(2, '0');
        const compRaw: FGTSCompetencia = {
          competencia: `${mesLabel}/${ano}`,
          tipo: 'mensal',
          base,
          percentual: 8,
          valor,
          valorOriginal: valor,
          incluido: true,
        };
        const comp = aplicarOverride(compRaw);
        competencias.push(comp);
        if (comp.incluido) subtotalAno += comp.valor;
        mesesTrabalhadosNoAno++;
      }
      
      // 13º como competência separada (sempre calculado, independente do 13º ter sido pago)
      {
        let base13: number;
        if (ano === anoFim) {
          // Ano da rescisão: 13º proporcional aos meses trabalhados no ano
          base13 = Math.round((salAno / 12) * mesesTrabalhadosNoAno * 100) / 100;
        } else if (ano === anoInicio && mesesTrabalhadosNoAno < 12) {
          // Primeiro ano incompleto: 13º proporcional
          base13 = Math.round((salAno / 12) * mesesTrabalhadosNoAno * 100) / 100;
        } else {
          // Ano completo: 13º integral
          base13 = salAno;
        }
        
        if (base13 > 0) {
          const valor13 = Math.round(base13 * 0.08 * 100) / 100;
          const compRaw: FGTSCompetencia = {
            competencia: `13º/${ano}`,
            tipo: '13º',
            base: base13,
            percentual: 8,
            valor: valor13,
            valorOriginal: valor13,
            incluido: true,
          };
          const comp = aplicarOverride(compRaw);
          competencias.push(comp);
          if (comp.incluido) subtotalAno += comp.valor;
        }
      }
      
      if (competencias.length > 0) {
        subtotalAno = Math.round(subtotalAno * 100) / 100;
        fgtsDetalhado.push({ ano, competencias, subtotal: subtotalAno });
        saldoFGTSCalculado += subtotalAno;
      }
    }
    
    saldoFGTSCalculado = Math.round(saldoFGTSCalculado * 100) / 100;
  } else {
    // Fallback sem data de admissão
    saldoFGTSCalculado = incluirFGTSGeral
      ? Math.round(dados.salarioBruto * meses13ComProjecao * 0.08 * 100) / 100
      : 0;
  }
  
  memorias.push({
    descricao: 'FGTS (8%)',
    formula: '8% sobre cada competência mensal + 13º proporcional',
    substituicao: fgtsDetalhado.map(a => `${a.ano}: R$ ${formatarMoeda(a.subtotal)}`).join(' | ') || `R$ ${formatarMoeda(dados.salarioBruto)} × ${meses13ComProjecao} × 8%`,
    resultado: saldoFGTSCalculado,
  });

  // Multa FGTS
  const multaFGTS = calcularMultaFGTS(saldoFGTSCalculado, dados.tipoDesligamento);
  if (multaFGTS > 0) {
    const percentual = dados.tipoDesligamento === 'acordo' ? 20 : 40;
    memorias.push({
      descricao: 'Multa FGTS',
      formula: `${percentual}% × Saldo FGTS`,
      substituicao: `${percentual}% × R$ ${formatarMoeda(saldoFGTSCalculado)}`,
      resultado: multaFGTS,
    });
  }
  
  // Proventos Extras
  const proventosExtrasTotal = dados.proventosExtras?.reduce((acc, p) => acc + p.valor, 0) || 0;
  if (proventosExtrasTotal > 0) {
    memorias.push({
      descricao: 'Proventos Extras',
      formula: 'Soma dos proventos adicionais',
      substituicao: dados.proventosExtras.map(p => `R$ ${formatarMoeda(p.valor)}`).join(' + '),
      resultado: proventosExtrasTotal,
    });
  }

  // Reflexos dos Proventos Extras em 13º e Férias
  // Regra (Súmula 45/151 TST, art. 142 §3º CLT): verbas habituais como comissões e
  // horas extras integram a base de cálculo do 13º e das férias quando assinaladas.
  const proventos13Total = (dados.proventosExtras || [])
    .filter(p => p.incideDecimoTerceiro)
    .reduce((acc, p) => acc + p.valor, 0);
  const proventosFeriasTotal = (dados.proventosExtras || [])
    .filter(p => p.incideFerias)
    .reduce((acc, p) => acc + p.valor, 0);

  // Reflexo no 13º: (total mensal / 12) × meses (com projeção do aviso)
  let reflexoProvento13 = 0;
  if (proventos13Total > 0 && tipoParaCalculo !== 'justa_causa' && meses13ComProjecao > 0) {
    reflexoProvento13 = (proventos13Total / 12) * meses13ComProjecao;
    memorias.push({
      descricao: 'Reflexo Proventos Extras no 13º',
      formula: '(Proventos com incid. 13º ÷ 12) × Meses',
      substituicao: `(R$ ${formatarMoeda(proventos13Total)} ÷ 12) × ${meses13ComProjecao}`,
      resultado: reflexoProvento13,
    });
  }

  // Reflexo em férias proporcionais + 1/3
  let reflexoProventoFeriasProp = 0;
  let reflexoProventoTercoFeriasProp = 0;
  if (proventosFeriasTotal > 0 && tipoParaCalculo !== 'justa_causa' && mesesFeriasComProjecao > 0) {
    reflexoProventoFeriasProp = (proventosFeriasTotal / 12) * mesesFeriasComProjecao;
    reflexoProventoTercoFeriasProp = reflexoProventoFeriasProp / 3;
    memorias.push({
      descricao: 'Reflexo Proventos Extras em Férias Proporcionais + 1/3',
      formula: '(Proventos com incid. Férias ÷ 12) × Meses + 1/3',
      substituicao: `(R$ ${formatarMoeda(proventosFeriasTotal)} ÷ 12) × ${mesesFeriasComProjecao} + 1/3`,
      resultado: reflexoProventoFeriasProp + reflexoProventoTercoFeriasProp,
    });
  }

  // Reflexo em férias vencidas + 1/3
  let reflexoProventoFeriasVenc = 0;
  let reflexoProventoTercoFeriasVenc = 0;
  if (proventosFeriasTotal > 0 && dados.feriasVencidas && dados.periodosFeriasVencidas > 0) {
    reflexoProventoFeriasVenc = proventosFeriasTotal * dados.periodosFeriasVencidas;
    reflexoProventoTercoFeriasVenc = reflexoProventoFeriasVenc / 3;
    memorias.push({
      descricao: 'Reflexo Proventos Extras em Férias Vencidas + 1/3',
      formula: 'Períodos × (Proventos com incid. Férias + 1/3)',
      substituicao: `${dados.periodosFeriasVencidas} × (R$ ${formatarMoeda(proventosFeriasTotal)} + 1/3)`,
      resultado: reflexoProventoFeriasVenc + reflexoProventoTercoFeriasVenc,
    });
  }

  const reflexosProventos = reflexoProvento13 + reflexoProventoFeriasProp + reflexoProventoTercoFeriasProp
    + reflexoProventoFeriasVenc + reflexoProventoTercoFeriasVenc;
  
  // Insalubridade
  let insalubridadeValor = 0;
  if (dados.insalubridade?.percentual > 0 && dados.insalubridade?.valorBase > 0) {
    insalubridadeValor = (dados.insalubridade.valorBase * dados.insalubridade.percentual) / 100;
    memorias.push({
      descricao: `Insalubridade (${dados.insalubridade.percentual}%)`,
      formula: 'Base × Percentual',
      substituicao: `R$ ${formatarMoeda(dados.insalubridade.valorBase)} × ${dados.insalubridade.percentual}%`,
      resultado: insalubridadeValor,
    });
  }
  
  // Periculosidade (30% do valor base ou salário bruto)
  let periculosidadeValor = 0;
  if (dados.periculosidade?.ativo) {
    const basePericulosidade = dados.periculosidade.valorBase > 0 
      ? dados.periculosidade.valorBase 
      : dados.salarioBruto;
    periculosidadeValor = basePericulosidade * 0.30;
    memorias.push({
      descricao: 'Periculosidade (30%)',
      formula: 'Base × 30%',
      substituicao: `R$ ${formatarMoeda(basePericulosidade)} × 30%`,
      resultado: periculosidadeValor,
    });
  }
  
  // 13º sobre aviso indenizado (projeção)
  const decimoTerceiroProjecao = projecaoAviso > 0 ? getSalarioAno(competenciaAno) / 12 * projecaoAviso : 0;

  // Cálculo do bruto
  const bruto = saldoSalario + avisoIndenizado + feriasProporcionais + tercoFerias + 
                feriasVencidas + tercoFeriasVencidas + decimoTerceiro + decimoTerceiroProjecao + multaFGTS +
                proventosExtrasTotal + insalubridadeValor + periculosidadeValor + reflexosProventos;
  
  // Base tributável para INSS
  let baseINSS = 0;
  if (configTributavel.saldo) baseINSS += saldoSalario;
  if (configTributavel.decimoTerceiro) baseINSS += decimoTerceiro + decimoTerceiroProjecao;
  if (configTributavel.avisoIndenizado) baseINSS += avisoIndenizado;
  // Insalubridade e Periculosidade incidem INSS
  baseINSS += insalubridadeValor;
  baseINSS += periculosidadeValor;
  // Proventos extras também incidem INSS
  baseINSS += proventosExtrasTotal;
  // Reflexos: 13º entra na base INSS se 13º for tributável; férias proporcionais/vencidas + 1/3 não geram INSS (indenizadas)
  if (configTributavel.decimoTerceiro) baseINSS += reflexoProvento13;
  
  // Calcular INSS apenas se habilitado
  const resultadoINSS = incluirINSS 
    ? calcularINSSProgressivo(baseINSS, tabelaINSS)
    : { total: 0, detalhes: [] };
  
  // Base tributável para IRRF
  let baseIRRF = 0;
  if (configTributavel.saldo) baseIRRF += saldoSalario;
  if (configTributavel.decimoTerceiro) baseIRRF += decimoTerceiro + decimoTerceiroProjecao;
  if (configTributavel.avisoIndenizado) baseIRRF += avisoIndenizado;
  if (configTributavel.feriasIndenizadas) baseIRRF += feriasProporcionais + tercoFerias + feriasVencidas + tercoFeriasVencidas;
  // Insalubridade e Periculosidade incidem IRRF
  baseIRRF += insalubridadeValor;
  baseIRRF += periculosidadeValor;
  // Proventos extras também incidem IRRF
  baseIRRF += proventosExtrasTotal;
  // Reflexos seguem a mesma config de tributação do verba base
  if (configTributavel.decimoTerceiro) baseIRRF += reflexoProvento13;
  if (configTributavel.feriasIndenizadas) {
    baseIRRF += reflexoProventoFeriasProp + reflexoProventoTercoFeriasProp
      + reflexoProventoFeriasVenc + reflexoProventoTercoFeriasVenc;
  }
  
  // Deduzir INSS da base IRRF
  const baseIRRFAposINSS = baseIRRF - resultadoINSS.total;
  
  // Calcular IRRF apenas se habilitado
  const resultadoIRRF = incluirIRRF
    ? calcularIRRF(
        baseIRRFAposINSS, 
        tabelaIRRF, 
        aplicarRedutor, 
        dependentes, 
        descontoSimplificado
      )
    : { total: 0, detalhes: [] };
  
  // Outros descontos
  const outrosDescontosTotal = dados.faltas + dados.outrosDescontos.reduce((acc, d) => acc + d.valor, 0);
  
  // Descontos legais
  const descontosLegais = resultadoINSS.total + resultadoIRRF.total;
  
  // Líquido
  const liquido = bruto - descontosLegais - outrosDescontosTotal;
  
  return {
    saldoSalario,
    avisoIndenizado,
    feriasProporcionais,
    tercoFerias,
    feriasVencidas,
    tercoFeriasVencidas,
    decimoTerceiro,
    decimoTerceiroPorAno,
    saldoFGTS: saldoFGTSCalculado,
    multaFGTS,
    proventosExtrasTotal,
    insalubridadeValor,
    periculosidadeValor,
    reflexoProvento13,
    reflexoProventoFeriasProp,
    reflexoProventoTercoFeriasProp,
    reflexoProventoFeriasVenc,
    reflexoProventoTercoFeriasVenc,
    bruto,
    baseINSS,
    inss: resultadoINSS.total,
    detalheINSS: resultadoINSS.detalhes,
    baseIRRF: baseIRRFAposINSS,
    irrf: resultadoIRRF.total,
    detalheIRRF: resultadoIRRF.detalhes,
    descontosLegais,
    outrosDescontosTotal,
    liquido,
    memorias,
    fgtsDetalhado,
  };
}

// Utilitários para localStorage
export function salvarTabelas(tabelaINSS: TabelaINSS[], tabelaIRRF: TabelaIRRF[]): void {
  localStorage.setItem('tabelaINSS', JSON.stringify(tabelaINSS));
  localStorage.setItem('tabelaIRRF', JSON.stringify(tabelaIRRF));
}

export function carregarTabelas(): { tabelaINSS: TabelaINSS[]; tabelaIRRF: TabelaIRRF[] } {
  try {
    const inss = localStorage.getItem('tabelaINSS');
    const irrf = localStorage.getItem('tabelaIRRF');
    return {
      tabelaINSS: inss ? JSON.parse(inss) : TABELA_INSS_PADRAO,
      tabelaIRRF: irrf ? JSON.parse(irrf) : TABELA_IRRF_PADRAO,
    };
  } catch {
    return { tabelaINSS: TABELA_INSS_PADRAO, tabelaIRRF: TABELA_IRRF_PADRAO };
  }
}

export function salvarConfigTributavel(config: ConfigTributavel): void {
  localStorage.setItem('configTributavel', JSON.stringify(config));
}

export function carregarConfigTributavel(): ConfigTributavel {
  try {
    const config = localStorage.getItem('configTributavel');
    return config ? JSON.parse(config) : CONFIG_TRIBUTAVEL_PADRAO;
  } catch {
    return CONFIG_TRIBUTAVEL_PADRAO;
  }
}

export function salvarFormulario(dados: DadosRescisao): void {
  localStorage.setItem('rescisaoForm', JSON.stringify(dados));
}

export function carregarFormulario(): DadosRescisao | null {
  try {
    const dados = localStorage.getItem('rescisaoForm');
    return dados ? JSON.parse(dados) : null;
  } catch {
    return null;
  }
}

export function limparFormulario(): void {
  localStorage.removeItem('rescisaoForm');
}
