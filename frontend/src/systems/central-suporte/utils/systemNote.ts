import { REOPEN_NOTE_PREFIX } from "./reopenTicket";

/** Texto usado tanto pra montar o comentário de encerramento (chat
 * flutuante) quanto pro regex abaixo que o reconhece como nota de sistema —
 * numa constante só pra não desalinhar silenciosamente se um dos dois lados
 * mudar sozinho. */
export const CLOSE_NOTE_PREFIX = "Este chat foi encerrado";

// Comentários automáticos de evento (reabertura, encerramento, transferência
// etc.) não têm uma coluna própria pra marcar isso — só dá pra reconhecer
// pelo texto. Compartilhado entre o chat flutuante (ConversationView) e o
// modal de detalhes (TicketDetailDialog) pra tratar os dois de forma
// consistente: viram um separador central, não uma bolha de conversa.
const SYSTEM_NOTE_PATTERN = new RegExp(
  `^(transferido de .+ para .+|categoria alterada|status alterado|prioridade alterada|${CLOSE_NOTE_PREFIX}|${REOPEN_NOTE_PREFIX})`,
  "i"
);

export function isSystemNote(content: string): boolean {
  const stripped = (content || "").trim().replace(/^[^\p{L}]+/u, "");
  return SYSTEM_NOTE_PATTERN.test(stripped);
}
