import { supabase } from "@suporte/integrations/supabase/client";

/** Prefixo reconhecido pelo chat flutuante (ConversationView) pra renderizar
 * essa nota como separador de sistema em vez de bolha de conversa comum. */
export const REOPEN_NOTE_PREFIX = "Chamado reaberto";

/**
 * Reabre um chamado encerrado (resolved/closed/canceled) exigindo um motivo,
 * registrado como comentário visível — sem isso não dá pra auditar depois
 * por que um chamado já dado como resolvido voltou a ficar ativo.
 */
export async function reopenTicketWithReason(ticketId: string, targetStatus: string, reason: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const authorName = profile?.full_name || "alguém da TI";

  const { error: statusError } = await supabase
    .from("tickets")
    .update({ status: targetStatus as any })
    .eq("id", ticketId)
    .is("archived_at", null);
  if (statusError) throw statusError;

  const { error: commentError } = await supabase.from("comments").insert({
    ticket_id: ticketId,
    content: `${REOPEN_NOTE_PREFIX} por ${authorName}. Motivo: ${reason}`,
    author_id: user.id,
    internal_only: false,
  });
  if (commentError) throw commentError;
}
