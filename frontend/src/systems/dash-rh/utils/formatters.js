/**
 * Formatting utilities for the HR Dashboard.
 * All monetary values use BRL (pt-BR) locale.
 */

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT_BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const PERCENT_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
});

/** Format a number as BRL currency — e.g. R$ 2.888,12 */
export function formatBRL(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return BRL_FORMATTER.format(value);
}

/** Format a number as compact BRL — e.g. R$ 2,9 mil */
export function formatBRLCompact(value) {
  if (value == null || isNaN(value)) return 'R$ 0';
  return COMPACT_BRL.format(value);
}

/** Format a number as percentage — e.g. 63,3% */
export function formatPercent(value) {
  if (value == null || isNaN(value)) return '0%';
  return `${PERCENT_FORMATTER.format(value)}%`;
}

/** Format tenure in years — e.g. 4,5 anos */
export function formatTenure(value) {
  if (value == null || isNaN(value)) return '0 anos';
  const formatted = NUMBER_FORMATTER.format(value);
  return `${formatted} ${value === 1 ? 'ano' : 'anos'}`;
}

/** Format a plain number with pt-BR locale */
export function formatNumber(value, decimals = 0) {
  if (value == null || isNaN(value)) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Truncate a string to maxLength with ellipsis */
export function truncate(str, maxLength = 20) {
  if (!str) return '';
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
}
