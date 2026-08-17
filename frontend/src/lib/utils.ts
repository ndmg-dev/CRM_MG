import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { differenceInCalendarDays, format, parseISO, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { StatusTarefa } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A API devolve datas sem fuso (`2026-08-20T23:59:00`), que o `parseISO`
 * leria como horário local. O `Z` força UTC e mantém o dia estável.
 */
function toUtcISO(dateString: string): string {
  const hasTz =
    dateString.endsWith('Z') ||
    dateString.includes('+') ||
    (dateString.includes('-') && dateString.split('T')[1]?.includes('-'))
  return hasTz ? dateString : `${dateString}Z`
}

export function formatDate(dateString: string): string {
  try {
    return format(parseISO(toUtcISO(dateString)), "dd/MM/yyyy", { locale: ptBR })
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString: string): string {
  try {
    return format(parseISO(toUtcISO(dateString)), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return dateString
  }
}

export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '')
  if (cleaned.length !== 14) return cnpj
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function isOverdue(dateString: string): boolean {
  try {
    const date = parseISO(toUtcISO(dateString))
    return isPast(date) && !isToday(date)
  } catch {
    return false
  }
}

/** Tom semântico do vencimento de uma tarefa. */
export type DueTone = 'error' | 'warning' | 'neutral' | 'muted'

export interface DueMeta {
  /** Sufixo curto ("atrasada", "hoje", "em 3 dias"); vazio quando não há urgência. */
  label: string
  tone: DueTone
  /** Dias de calendário até o vencimento; negativo se já passou. */
  days: number
}

/**
 * Como o vencimento deve ser lido no card e na lista. Concluída nunca alarma:
 * o prazo já não é acionável, então a data fica apagada e sem sufixo.
 */
export function dueMeta(dateString: string, status: StatusTarefa): DueMeta {
  let days: number
  try {
    days = differenceInCalendarDays(parseISO(toUtcISO(dateString)), new Date())
  } catch {
    return { label: '', tone: 'neutral', days: 0 }
  }

  if (status === 'CONCLUIDO') return { label: '', tone: 'muted', days }
  if (days < 0) return { label: 'atrasada', tone: 'error', days }
  if (days === 0) return { label: 'hoje', tone: 'warning', days }
  if (days <= 3) return { label: `em ${days} ${days === 1 ? 'dia' : 'dias'}`, tone: 'warning', days }
  return { label: '', tone: 'neutral', days }
}

/** Vence dentro da janela informada (padrão: 7 dias), sem estar atrasada. */
export function isDueSoon(dateString: string, withinDays = 7): boolean {
  try {
    const days = differenceInCalendarDays(parseISO(toUtcISO(dateString)), new Date())
    return days >= 0 && days <= withinDays
  } catch {
    return false
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
