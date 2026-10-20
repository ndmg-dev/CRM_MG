// Helpers de apresentação (pt-BR). Os valores monetários podem chegar como
// number ou string (Decimal do Pydantic) — sempre normalizamos com Number().

import type { Money } from './types'

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function fmtBRL(v: Money | null | undefined): string {
  const n = Number(v ?? 0)
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
