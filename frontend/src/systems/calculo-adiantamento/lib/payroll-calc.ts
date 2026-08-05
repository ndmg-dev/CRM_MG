import type { EmployeePayroll, EmployeeAdvance, CalcConfig, RoundingMode } from './types';
import { DEFAULT_CALC_CONFIG } from './types';

function roundValue(value: number, mode: RoundingMode): number {
  const cents = value * 100;
  if (mode === 'ceil') return Math.ceil(cents) / 100;
  if (mode === 'round') return Math.round(cents) / 100;
  return Math.floor(cents) / 100; // floor (padrão)
}

export function calcBase(emp: EmployeePayroll, config: CalcConfig = DEFAULT_CALC_CONFIG): number {
  if (config.baseMode === 'pe') {
    return (emp.bruto || 0) - (emp.planoSaude || 0) - (emp.inss || 0) - (emp.irrf || 0);
  }
  return config.subtractAdiantamento
    ? emp.liquido - (emp.descAdiantamento || 0)
    : emp.liquido;
}

export function calcularAdiantamento(
  emp: EmployeePayroll,
  config: CalcConfig = DEFAULT_CALC_CONFIG
): EmployeeAdvance {
  const base = calcBase(emp, config);
  const valorAdiantamento = roundValue(Math.max(0, base) * (config.percent / 100), config.rounding);

  return {
    ...emp,
    valorAdiantamento,
  };
}

export function formatPercent(percent: number): string {
  return `${percent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function parseNumericValue(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.,-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export function buildAuditString(
  emp: EmployeeAdvance,
  config: CalcConfig = DEFAULT_CALC_CONFIG
): string {
  const f = (n: number) => n.toFixed(2);
  const base = calcBase(emp, config);
  const pct = formatPercent(config.percent);
  if (config.baseMode === 'pe') {
    return `(Bruto ${f(emp.bruto)} − Plano ${f(emp.planoSaude)} − INSS ${f(emp.inss)} − IRRF ${f(emp.irrf)} = ${f(base)}) × ${pct} = ${f(emp.valorAdiantamento)}`;
  }
  if (config.subtractAdiantamento) {
    return `(Líquido ${f(emp.liquido)} − Desc. Adiant. ${f(emp.descAdiantamento || 0)} = ${f(base)}) × ${pct} = ${f(emp.valorAdiantamento)}`;
  }
  return `Líquido ${f(emp.liquido)} × ${pct} = ${f(emp.valorAdiantamento)}`;
}
