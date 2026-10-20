// Helpers de apresentação (pt-BR). Os valores monetários podem chegar como
// number ou string (Decimal do Pydantic) — sempre normalizamos com Number().

import type { Money } from './types'

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function fmtBRL(v: Money | null | undefined): string {
  const n = Number(v ?? 0)
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Sem centavos — "R$ 90.000". Usado em cards de sócio e no heatmap. */
export function fmtBRL0(v: Money | null | undefined): string {
  const n = Number(v ?? 0)
  if (Number.isNaN(n)) return '—'
  return `R$ ${Math.round(n).toLocaleString('pt-BR')}`
}

/** Compacto pros KPIs — "R$ 4,82 mi", "R$ 820 mil". */
export function fmtBRLCompact(v: Money | null | undefined): string {
  const n = Number(v ?? 0)
  if (Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`
  if (abs >= 10_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return fmtBRL0(n)
}

export function fmtCNPJ(cnpj: string | null | undefined): string {
  const d = (cnpj || '').replace(/\D/g, '')
  if (d.length !== 14) return cnpj || '—'
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function iniciais(nome: string | null | undefined): string {
  return (nome || '')
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** Quantos meses são "esperados" num ano: até o mês corrente no ano atual, 12 em anos passados. */
export function mesesEsperados(ano: number): number {
  const agora = new Date()
  if (ano < agora.getFullYear()) return 12
  if (ano > agora.getFullYear()) return 0
  return agora.getMonth() + 1
}
