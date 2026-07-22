import { differenceInDays, addMonths, addDays, startOfMonth, endOfMonth, format } from 'date-fns';

export interface CalculoFerias {
  mesesPeriodoAquisitivo: number;
  feriasVencidas: boolean;
  periodosFeriasVencidas: number;
  feriasDobradas: boolean;
}

export interface PeriodoAquisitivo {
  label: string; // e.g. "2022/2023"
  inicio: Date;
  fim: Date;
  completo: boolean;
  dobrado: boolean; // true se ultrapassou o prazo concessivo (CLT art. 137)
}

/**
 * Gera a lista de períodos aquisitivos a partir da data de admissão até a data de rescisão.
 * Cada período é de 12 meses contados a partir do aniversário de admissão.
 */
export function gerarPeriodosAquisitivos(
  dataAdmissao: Date | null,
  dataRescisao: Date
): PeriodoAquisitivo[] {
  if (!dataAdmissao) return [];
  
  const periodos: PeriodoAquisitivo[] = [];
  let inicio = new Date(dataAdmissao);
  
  while (inicio < dataRescisao) {
    const fim = addDays(addMonths(inicio, 12), -1);
    const completo = fim <= dataRescisao;
    
    // Prazo concessivo: 12 meses após o fim do período aquisitivo (CLT art. 137)
    const fimPrazoConcessivo = addMonths(fim, 12);
    const dobrado = completo && dataRescisao > fimPrazoConcessivo;
    
    const anoInicio = inicio.getFullYear();
    const label = `${anoInicio}/${anoInicio + 1}`;
    
    periodos.push({ label, inicio, fim, completo, dobrado });
    
    if (!completo) break;
    inicio = addMonths(inicio, 12);
  }
  
  return periodos;
}

/**
 * Calcula automaticamente o período de férias baseado nas datas de admissão e rescisão.
 */
export function calcularPeriodoFerias(
  dataAdmissao: Date | null,
  dataRescisao: Date
): CalculoFerias {
  if (!dataAdmissao) {
    return {
      mesesPeriodoAquisitivo: 0,
      feriasVencidas: false,
      periodosFeriasVencidas: 0,
      feriasDobradas: false,
    };
  }

  const totalDias = differenceInDays(dataRescisao, dataAdmissao);
  
  if (totalDias < 0) {
    return {
      mesesPeriodoAquisitivo: 0,
      feriasVencidas: false,
      periodosFeriasVencidas: 0,
      feriasDobradas: false,
    };
  }

  let mesesCompletos = 0;
  let dataInicioMes = new Date(dataAdmissao);
  
  while (true) {
    const dataFimMes = addDays(addMonths(dataInicioMes, 1), -1);
    
    if (dataFimMes > dataRescisao) {
      const diasTrabalhados = differenceInDays(dataRescisao, dataInicioMes) + 1;
      if (diasTrabalhados >= 15) {
        mesesCompletos++;
      }
      break;
    }
    
    mesesCompletos++;
    dataInicioMes = addMonths(dataInicioMes, 1);
  }
  
  const periodosCompletos = Math.floor(mesesCompletos / 12);
  const mesesPeriodoAquisitivo = mesesCompletos;
  const feriasVencidas = periodosCompletos > 0;
  const periodosFeriasVencidas = periodosCompletos;
  const feriasDobradas = mesesCompletos >= 24 && periodosCompletos >= 1;

  return {
    mesesPeriodoAquisitivo,
    feriasVencidas,
    periodosFeriasVencidas,
    feriasDobradas,
  };
}

/**
 * Calcula anos de empresa baseado nas datas (usando aniversário de admissão)
 */
export function calcularAnosEmpresa(
  dataAdmissao: Date | null,
  dataRescisao: Date
): number {
  if (!dataAdmissao) return 0;
  
  let anos = dataRescisao.getFullYear() - dataAdmissao.getFullYear();
  
  const aniversarioNoAno = new Date(
    dataRescisao.getFullYear(),
    dataAdmissao.getMonth(),
    dataAdmissao.getDate()
  );
  
  if (dataRescisao < aniversarioNoAno) {
    anos--;
  }
  
  return Math.max(0, anos);
}

/**
 * Calcula meses trabalhados desde a admissão até a rescisão para 13º proporcional.
 * Conta meses civis com 15+ dias trabalhados, sem limitar ao ano corrente.
 */
export function calcularMesesNoPeriodo(
  dataAdmissao: Date | null,
  dataRescisao: Date
): number {
  if (!dataAdmissao) return 0;
  
  let mesesContados = 0;
  
  // Iterar por todos os meses desde admissão até rescisão
  let ano = dataAdmissao.getFullYear();
  let mes = dataAdmissao.getMonth();
  
  const anoFim = dataRescisao.getFullYear();
  const mesFim = dataRescisao.getMonth();
  
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    const inicioMes = startOfMonth(new Date(ano, mes, 1));
    const fimMes = endOfMonth(new Date(ano, mes, 1));
    
    const dataInicioContagem = dataAdmissao > inicioMes ? dataAdmissao : inicioMes;
    const dataFimContagem = dataRescisao < fimMes ? dataRescisao : fimMes;
    
    if (dataAdmissao <= fimMes && dataRescisao >= inicioMes) {
      const diasTrabalhados = differenceInDays(dataFimContagem, dataInicioContagem) + 1;
      if (diasTrabalhados > 15) {
        mesesContados++;
      }
    }
    
    mes++;
    if (mes > 11) {
      mes = 0;
      ano++;
    }
  }
  
  return mesesContados;
}

/**
 * Calcula meses trabalhados por ano (para cálculos proporcionais de 13º e FGTS por ano).
 */
export function calcularMesesPorAno(
  dataAdmissao: Date | null,
  dataRescisao: Date
): Record<number, number> {
  if (!dataAdmissao) return {};
  
  const resultado: Record<number, number> = {};
  const anoInicio = dataAdmissao.getFullYear();
  const anoFim = dataRescisao.getFullYear();
  
  for (let ano = anoInicio; ano <= anoFim; ano++) {
    let meses = 0;
    for (let mes = 0; mes <= 11; mes++) {
      const inicioMes = startOfMonth(new Date(ano, mes, 1));
      const fimMes = endOfMonth(new Date(ano, mes, 1));
      
      if (dataAdmissao > fimMes || dataRescisao < inicioMes) continue;
      
      const di = dataAdmissao > inicioMes ? dataAdmissao : inicioMes;
      const df = dataRescisao < fimMes ? dataRescisao : fimMes;
      
      const dias = differenceInDays(df, di) + 1;
      // Regra: admissão exige > 15 dias (admissão até dia 15);
      // rescisão exige >= 15 dias (rescisão a partir do dia 15).
      const isMesAdmissao =
        dataAdmissao.getFullYear() === ano && dataAdmissao.getMonth() === mes;
      const isMesRescisao =
        dataRescisao.getFullYear() === ano && dataRescisao.getMonth() === mes;

      let conta = true;
      if (isMesAdmissao && isMesRescisao) {
        conta = dias > 15;
      } else if (isMesAdmissao) {
        conta = dias > 15;
      } else if (isMesRescisao) {
        conta = dias >= 15;
      }
      if (conta) meses++;
    }
    if (meses > 0) resultado[ano] = meses;
  }
  
  return resultado;
}

/**
 * Retorna lista de anos entre admissão e rescisão.
 */
export function getAnosNoPeriodo(
  dataAdmissao: Date | null,
  dataRescisao: Date
): number[] {
  if (!dataAdmissao) return [];
  const anos: number[] = [];
  for (let a = dataAdmissao.getFullYear(); a <= dataRescisao.getFullYear(); a++) {
    anos.push(a);
  }
  return anos;
}

/**
 * Calcula meses trabalhados no ano corrente para 13º (mantido para compatibilidade)
 */
export function calcularMesesNoAno(
  dataAdmissao: Date | null,
  dataRescisao: Date
): number {
  if (!dataAdmissao) return 0;
  
  const anoRescisao = dataRescisao.getFullYear();
  let mesesContados = 0;
  
  for (let mes = 0; mes <= dataRescisao.getMonth(); mes++) {
    const inicioMes = startOfMonth(new Date(anoRescisao, mes, 1));
    const fimMes = endOfMonth(new Date(anoRescisao, mes, 1));
    
    const dataInicioContagem = dataAdmissao > inicioMes ? dataAdmissao : inicioMes;
    const dataFimContagem = dataRescisao < fimMes ? dataRescisao : fimMes;
    
    if (dataAdmissao > fimMes) continue;
    if (dataRescisao < inicioMes) continue;
    
    const diasTrabalhados = differenceInDays(dataFimContagem, dataInicioContagem) + 1;
    
    if (diasTrabalhados >= 15) {
      mesesContados++;
    }
  }
  
  return Math.min(mesesContados, 12);
}
