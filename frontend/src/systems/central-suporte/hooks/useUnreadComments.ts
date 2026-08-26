import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";

/** Bolinha de comentário não lido no card do Kanban: conta notificações
 * de "Novo comentário" ainda não lidas, agrupadas por ticket. */
export function useUnreadComments() {
  const queryClient = useQueryClient();
  const instanceId = useId();

  const { data: counts } = useQuery({
    queryKey: ["unread-comment-counts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {} as Record<string, number>;

      const { data, error } = await supabase
        .from("notifications")
        .select("ticket_id")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .eq("title", "Novo comentário")
        .not("ticket_id", "is", null);
      if (error) throw error;

      const map: Record<string, number> = {};
      for (const row of data || []) {
        if (!row.ticket_id) continue;
        map[row.ticket_id] = (map[row.ticket_id] || 0) + 1;
      }
      return map;
    },
  });

  useEffect(() => {
    // Nome de canal único por instância: este hook roda em mais de um
    // componente ao mesmo tempo (ícone flutuante + lista de conversas), e
    // um nome fixo faz a segunda instância reaproveitar o canal já
    // inscrito da primeira — daí o erro "cannot add postgres_changes
    // callbacks... after subscribe()".
    const channel = supabase
      .channel(`unread-comments-realtime-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => queryClient.invalidateQueries({ queryKey: ["unread-comment-counts"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, instanceId]);

  return counts || {};
}

/** Marca como lidas as notificações de comentário de um chamado específico. */
export async function markCommentNotificationsRead(ticketId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("ticket_id", ticketId)
    .eq("title", "Novo comentário")
    .eq("is_read", false);
}
