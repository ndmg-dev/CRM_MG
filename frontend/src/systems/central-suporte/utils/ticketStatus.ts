/** Status considerados "encerrado": chamado só volta a receber mensagem se
 * for movido de novo pra um status fora desta lista. Usado tanto no chat
 * flutuante (lista e conversa) quanto no aviso de notificação do Header. */
export const CLOSED_TICKET_STATUSES = new Set(['resolved', 'closed', 'canceled'])

export function isTicketClosed(status: string | null | undefined): boolean {
  return !!status && CLOSED_TICKET_STATUSES.has(status)
}

/** Categoria de exibição do chamado nas abas do chat flutuante.
 *
 * PROVISÓRIO: o enum `ticket_status` não tem um valor dedicado pra "em
 * andamento" — `new`, `open` e `pending` são todos "chamado novo" pro
 * negócio. Até rodar a migração que adiciona um status `in_progress` de
 * verdade, `open` é temporariamente emprestado pra representar "Em
 * Andamento" aqui no chat (mesmo sendo, estritamente, mais um sinônimo de
 * "novo"). Isso diverge do TicketDetailDialog.tsx, que ainda trata `open`
 * como "A Fazer" — esse arquivo também precisa ser corrigido quando a
 * migração acontecer. Buscar por "PROVISÓRIO" pra achar os pontos a trocar.
 *   - todo:        chamado novo, ninguém da TI tratou ainda ("A Fazer")
 *   - in_progress: TI já está tratando ("Em Andamento") — hoje = `open`
 *   - closed/testing/parado: sub-opções do dropdown "Outros"
 * `status` nulo (chamado sem status carregado ainda) cai em "todo" — mais
 * seguro que esconder o chamado de qualquer aba. */
export type TicketCategory = 'todo' | 'in_progress' | 'closed' | 'testing' | 'parado'

export function ticketCategory(status: string | null | undefined): TicketCategory {
  if (!status || status === 'new' || status === 'pending') return 'todo'
  if (status === 'open') return 'in_progress' // PROVISÓRIO — ver comentário acima
  if (status === 'testing') return 'testing'
  if (status === 'parado') return 'parado'
  if (CLOSED_TICKET_STATUSES.has(status)) return 'closed'
  return 'todo'
}
