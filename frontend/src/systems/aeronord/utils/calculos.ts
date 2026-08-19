import { Convencao, ConvencaoCalculos } from '@aeronord/types/convencao';

export const VALOR_HORA_FIXO = 9;
export const VALOR_ALIMENTACAO_MES = 553.32;
export const HORAS_MES = 220;

export function calcularConvencao(convencao: Convencao): ConvencaoCalculos {
  const { horas } = convencao;

  // Resultado 1: Horas x Valor Hora (sempre 9)
  const resultado1 = horas * VALOR_HORA_FIXO;

  // Resultado 2: DSR (Descanso Semanal Remunerado) = resultado1 / 6
  const resultado2 = resultado1 / 6;

  // Resultado 3: Periculosidade = (resultado1 + resultado2) * 0.30
  const resultado3 = (resultado1 + resultado2) * 0.30;

  // Resultado 4: Alimentação = (553.32 / 220) * horas
  const resultado4 = (VALOR_ALIMENTACAO_MES / HORAS_MES) * horas;

  // Resultado 5: Férias = (resultado1 + resultado2 + resultado3) / 12
  const resultado5 = (resultado1 + resultado2 + resultado3) / 12;

  // Resultado 6: 1/3 Férias = resultado5 / 3
  const resultado6 = resultado5 / 3;

  // Resultado 7: 13º Salário = (resultado1 + resultado2 + resultado3) / 12
  const resultado7 = (resultado1 + resultado2 + resultado3) / 12;

  // Total de proventos
  const totalProventos = resultado1 + resultado2 + resultado3 + resultado4 + resultado5 + resultado6 + resultado7;

  // INSS = 7.5% de (resultado1 + resultado2 + resultado3 + resultado5 + resultado6 + resultado7) - NÃO inclui alimentação
  const inss = (resultado1 + resultado2 + resultado3 + resultado5 + resultado6 + resultado7) * 0.075;

  // Total de descontos
  const totalDescontos = inss;

  // Líquido a receber
  const liquidoReceber = totalProventos - totalDescontos;

  return {
    resultado1,
    resultado2,
    resultado3,
    resultado4,
    resultado5,
    resultado6,
    resultado7,
    inss,
    totalProventos,
    totalDescontos,
    liquidoReceber,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatMonthYear(mesReferencia: string): string {
  if (!mesReferencia) return '';
  const [year, month] = mesReferencia.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
