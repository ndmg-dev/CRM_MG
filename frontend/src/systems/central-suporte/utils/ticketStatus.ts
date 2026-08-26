/** Status considerados "encerrado": chamado só volta a receber mensagem se
 * for movido de novo pra um status fora desta lista. Usado tanto no chat
 * flutuante (lista e conversa) quanto no aviso de notificação do Header. */
export const CLOSED_TICKET_STATUSES = new Set(['resolved', 'closed', 'canceled'])

export function isTicketClosed(status: string | null | undefined): boolean {
  return !!status && CLOSED_TICKET_STATUSES.has(status)
}

/** Categoria de exibição do chamado nas abas do chat flutuante:
 *   - todo:        novo, ninguém da TI respondeu ainda ("A fazer")
 *   - in_progress: TI já está tratando ("Em Andamento")
 *   - closed/testing/parado: sub-opções do dropdown "Outros"
 * `status` nulo (chamado sem status carregado ainda) cai em "todo" — mais
 * seguro que esconder o chamado de qualquer aba. */
export type TicketCategory = 'todo' | 'in_progress' | 'closed' | 'testing' | 'parado'

export function ticketCategory(status: string | null | undefined): TicketCategory {
  if (!status || status === 'new') return 'todo'
  if (status === 'open' || status === 'pending') return 'in_progress'
  if (status === 'testing') return 'testing'
  if (status === 'parado') return 'parado'
  if (CLOSED_TICKET_STATUSES.has(status)) return 'closed'
  return 'todo'
}
