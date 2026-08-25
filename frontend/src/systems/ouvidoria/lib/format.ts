// Labels/cores em pt-BR pros ENUMs do banco — mesmos dicionários (status_map,
// label_map, cat_map, pri_map, pri_label, type_map) espalhados por todos os
// templates Jinja2 do repo original (list.html, detail.html,
// admin/complaints.html, admin/complaint_detail.html, admin/dashboard.html).
// Centralizados aqui em vez de repetidos por página.
import type {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  ComplaintType,
} from './types'

export type BadgeVariant = 'info' | 'warning' | 'accent' | 'success' | 'secondary' | 'danger' | 'gold'

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  aberta: 'Aberta',
  em_analise: 'Em Análise',
  em_tratativa: 'Em Tratativa',
  aguardando_usuario: 'Aguardando',
  concluida: 'Concluída',
  arquivada: 'Arquivada',
}

export const STATUS_BADGE: Record<ComplaintStatus, BadgeVariant> = {
  aberta: 'info',
  em_analise: 'warning',
  em_tratativa: 'warning',
  aguardando_usuario: 'accent',
  concluida: 'success',
  arquivada: 'secondary',
}

export const ALL_STATUSES: ComplaintStatus[] = [
  'aberta',
  'em_analise',
  'em_tratativa',
  'aguardando_usuario',
  'concluida',
  'arquivada',
]

export const PRIORITY_LABEL: Record<ComplaintPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const PRIORITY_BADGE: Record<ComplaintPriority, BadgeVariant> = {
  baixa: 'success',
  media: 'info',
  alta: 'warning',
  urgente: 'danger',
}

export const ALL_PRIORITIES: ComplaintPriority[] = ['baixa', 'media', 'alta', 'urgente']

export const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  reclamacao: 'Reclamação',
  sugestao: 'Sugestão',
  elogio: 'Elogio',
  denuncia: 'Denúncia',
  duvida: 'Dúvida',
  solicitacao: 'Solicitação',
  outro: 'Outro',
}

export const ALL_CATEGORIES: ComplaintCategory[] = [
  'reclamacao',
  'sugestao',
  'elogio',
  'denuncia',
  'duvida',
  'solicitacao',
  'outro',
]

export const TYPE_LABEL: Record<ComplaintType, string> = {
  assedio_moral: 'Assédio Moral',
  assedio_sexual: 'Assédio Sexual',
  discriminacao: 'Discriminação',
  condicoes_trabalho: 'Condições de Trabalho',
  remuneracao: 'Remuneração',
  beneficios: 'Benefícios',
  gestao: 'Gestão',
  comunicacao: 'Comunicação',
  politicas_internas: 'Políticas Internas',
  relacionamento: 'Relacionamento',
  outro: 'Outro',
}

export const ALL_TYPES: ComplaintType[] = [
  'outro',
  'assedio_moral',
  'assedio_sexual',
  'discriminacao',
  'condicoes_trabalho',
  'remuneracao',
  'beneficios',
  'gestao',
  'comunicacao',
  'politicas_internas',
  'relacionamento',
]

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as ComplaintStatus] ?? status
}

export function statusBadge(status: string): BadgeVariant {
  return STATUS_BADGE[status as ComplaintStatus] ?? 'secondary'
}

export function priorityLabel(priority: string): string {
  return PRIORITY_LABEL[priority as ComplaintPriority] ?? priority
}

export function priorityBadge(priority: string): BadgeVariant {
  return PRIORITY_BADGE[priority as ComplaintPriority] ?? 'secondary'
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category as ComplaintCategory] ?? category
}

export function typeLabel(type: string): string {
  return TYPE_LABEL[type as ComplaintType] ?? type
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return value.slice(0, 10)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return value.slice(0, 16).replace('T', ' ')
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(11, 16)
}
