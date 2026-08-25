export type TicketStatusBucket = 'open' | 'closed' | 'other'

/** Status considerados "encerrado": chamado só volta a receber mensagem se
 * for movido de novo pra um status fora desta lista. Usado tanto no chat
 * flutuante (lista e conversa) quanto no aviso de notificação do Header. */
export const CLOSED_TICKET_STATUSES = new Set(['resolved', 'closed', 'canceled'])

/** "parado" e "testing" ficam fora de aberto/encerrado — não são chamados
 * ativos, mas também não terminaram; agrupados à parte na aba "Outros" do
 * chat flutuante. */
const OTHER_TICKET_STATUSES = new Set(['parado', 'testing'])

export function isTicketClosed(status: string | null | undefined): boolean {
  return !!status && CLOSED_TICKET_STATUSES.has(status)
}

/** Agrupa o status do chamado nas três abas do chat flutuante: novos/em
 * andamento (open), encerrados (closed) ou parados (other). */
export function ticketStatusBucket(status: string | null | undefined): TicketStatusBucket {
  if (!status) return 'open'
  if (CLOSED_TICKET_STATUSES.has(status)) return 'closed'
  if (OTHER_TICKET_STATUSES.has(status)) return 'other'
  return 'open'
}
