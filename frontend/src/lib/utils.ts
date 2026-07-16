import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  try {
    const tzString = dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-') && dateString.split('T')[1]?.includes('-') ? dateString : `${dateString}Z`
    return format(parseISO(tzString), "dd/MM/yyyy", { locale: ptBR })
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const tzString = dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-') && dateString.split('T')[1]?.includes('-') ? dateString : `${dateString}Z`
    return format(parseISO(tzString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
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
    const tzString = dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-') && dateString.split('T')[1]?.includes('-') ? dateString : `${dateString}Z`
    const date = parseISO(tzString)
    return isPast(date) && !isToday(date)
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
