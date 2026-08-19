export interface OvertimeResult {
  employeeName: string;
  baseAmount: number;
  monthlyHours: number;
  hourlyBase: number;
  overtimeRatePercent: number;
  hourlyOvertime: number;
  overtimeHours: number;
  overtimeTotal: number;
}

export class ValidationError extends Error {}

/**
 * Segue a Memória de Cálculo de Rubricas:
 *   hourlyBase     = baseAmount / monthlyHours
 *   hourlyOvertime = hourlyBase * (overtimeRatePercent / 100)
 *   overtimeTotal  = hourlyOvertime * overtimeHours
 */
export function calculateOvertimeFromBase(
  employeeName: string,
  baseAmount: number,
  monthlyHours: number,
  overtimeHours: number,
  overtimeRatePercent: number
): OvertimeResult {
  if (baseAmount <= 0) throw new ValidationError('A base de cálculo das horas extras deve ser maior que zero.');
  if (monthlyHours <= 0) throw new ValidationError('As horas mensais devem ser maiores que zero.');
  if (overtimeHours <= 0) throw new ValidationError('A quantidade de horas extras deve ser maior que zero.');
  if (overtimeRatePercent <= 0) throw new ValidationError('A taxa de horas extras deve ser maior que zero.');

  const hourlyBase = baseAmount / monthlyHours;
  const hourlyOvertime = hourlyBase * (overtimeRatePercent / 100);
  const overtimeTotal = hourlyOvertime * overtimeHours;

  return {
    employeeName,
    baseAmount: Math.round(baseAmount * 100) / 100,
    monthlyHours,
    hourlyBase,
    overtimeRatePercent,
    hourlyOvertime,
    overtimeHours,
    overtimeTotal,
  };
}

export function formatCurrency(value: number, decimals = 2): string {
  return `R$ ${value.toFixed(decimals).replace('.', ',')}`;
}

/** Aceita tanto "1234,56" (pt-BR) quanto "1234.56". */
export function parseLocaleFloat(text: string): number {
  const normalized = text.trim().replace(',', '.');
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}
