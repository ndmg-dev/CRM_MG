import { useEffect, useRef, useState } from "react";
import { Bell, MessageSquare } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { supabase } from "@suporte/integrations/supabase/client";
import { playNotificationSound } from "@suporte/lib/notification-sound";
import { showBrowserNotification } from "@suporte/hooks/useBrowserNotifications";

const MESSAGE_TITLE = "Novo comentário";

/**
 * Sinos do Central de Suporte (chamados + mensagens), fixos no CRM inteiro —
 * não dentro do sistema. Ficam visíveis e tocam som mesmo com outro sistema
 * aberto (Férias, Obrigações etc.), porque o Header normal some quando um
 * sistema nativo está em tela cheia (fullBleedSystem).
 *
 * A sessão do Supabase da Central já existe desde o login (SSO unificado em
 * unifiedAuth.ts), então isso funciona sem precisar abrir o sistema primeiro.
 */
export function GlobalTicketNotifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [openTickets, setOpenTickets] = useState(false);
  const [openMessages, setOpenMessages] = useState(false);
  const ticketsRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const { data: sistemas } = useQuery({
    queryKey: ["sistemas"],
    queryFn: () => api.sistemas.getAll(),
  });
  const centralSuporteId = sistemas?.find(
    (s) => s.slug === "central-de-suporte" || s.slug === "central-suporte"
  )?.id;

  const goToChamados = () => {
    if (centralSuporteId) navigate(`/sistemas/${centralSuporteId}`);
  };

  const { data: ticketNotifications } = useQuery({
    queryKey: ["global-ticket-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .neq("title", MESSAGE_TITLE)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: messageNotifications } = useQuery({
    queryKey: ["global-message-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("title", MESSAGE_TITLE)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const unreadTickets = ticketNotifications?.filter((n) => !n.is_read).length || 0;
  const unreadMessages = messageNotifications?.filter((n) => !n.is_read).length || 0;

  useEffect(() => {
    const setupChannel = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel("global-central-suporte-notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            const record = payload?.new;
            const isMessage = !!record?.title?.includes(MESSAGE_TITLE);

            if (isMessage) {
              queryClient.invalidateQueries({ queryKey: ["global-message-notifications"] });
              queryClient.invalidateQueries({ queryKey: ["unread-comment-counts"] });
              playNotificationSound("comment_received");
            } else {
              queryClient.invalidateQueries({ queryKey: ["global-ticket-notifications"] });
              const isClosing = record?.title?.includes("Encerrado");
              if (record?.ticket_id && !isClosing) {
                supabase.from("tickets").select("assignee_id").eq("id", record.ticket_id).single().then(({ data: ticket }) => {
                  playNotificationSound("ticket_opened", ticket?.assignee_id);
                });
              } else {
                playNotificationSound(isClosing ? "ticket_closed" : "ticket_opened");
              }
            }
            if (record) {
              showBrowserNotification(record.title || "Nova notificação", record.message || "");
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupChannel();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [queryClient]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ticketsRef.current && !ticketsRef.current.contains(e.target as Node)) setOpenTickets(false);
      if (messagesRef.current && !messagesRef.current.contains(e.target as Node)) setOpenMessages(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const markAllRead = async (onlyMessages: boolean, queryKey: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let query = supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    query = onlyMessages ? query.eq("title", MESSAGE_TITLE) : query.neq("title", MESSAGE_TITLE);
    await query;
    queryClient.invalidateQueries({ queryKey });
    if (onlyMessages) queryClient.invalidateQueries({ queryKey: ["unread-comment-counts"] });
  };

  const markOneRead = async (id: string, queryKey: string[], isMessage: boolean) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey });
    if (isMessage) queryClient.invalidateQueries({ queryKey: ["unread-comment-counts"] });
  };

  return (
    <div className="fixed top-2.5 right-[68px] z-[100] flex items-center gap-1">
      {/* Mensagens */}
      <div className="relative" ref={messagesRef}>
        <button
          type="button"
          onClick={() => { setOpenMessages((v) => !v); setOpenTickets(false); }}
          aria-label="Mensagens"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 backdrop-blur-md border border-border text-text-secondary shadow-lg transition-colors hover:bg-surface hover:text-text-primary"
        >
          <MessageSquare className="h-[18px] w-[18px]" />
          {unreadMessages > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-background">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </button>
        {openMessages && (
          <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-3">
              <h3 className="text-sm font-semibold text-text-primary">Mensagens</h3>
              {unreadMessages > 0 && (
                <button
                  className="text-xs text-gold hover:underline"
                  onClick={() => markAllRead(true, ["global-message-notifications"])}
                >
                  Marcar tudo como lido
                </button>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {(!messageNotifications || messageNotifications.length === 0) ? (
                <p className="py-8 text-center text-xs text-text-muted">Nenhuma mensagem</p>
              ) : (
                messageNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`cursor-pointer border-b border-border px-4 py-2.5 last:border-0 hover:bg-surface-hover ${!n.is_read ? "bg-surface-raised/50" : ""}`}
                    onClick={() => { markOneRead(n.id, ["global-message-notifications"], true); setOpenMessages(false); goToChamados(); }}
                  >
                    <p className="text-sm text-text-primary">{n.title}</p>
                    {n.message && <p className="mt-0.5 text-xs text-text-muted line-clamp-2">{n.message}</p>}
                    <p className="mt-1 text-[10px] text-text-muted">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chamados */}
      <div className="relative" ref={ticketsRef}>
        <button
          type="button"
          onClick={() => { setOpenTickets((v) => !v); setOpenMessages(false); }}
          aria-label="Notificações de chamados"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 backdrop-blur-md border border-border text-text-secondary shadow-lg transition-colors hover:bg-surface hover:text-text-primary"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadTickets > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-background">
              {unreadTickets > 9 ? "9+" : unreadTickets}
            </span>
          )}
        </button>
        {openTickets && (
          <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-3">
              <h3 className="text-sm font-semibold text-text-primary">Chamados</h3>
              {unreadTickets > 0 && (
                <button
                  className="text-xs text-gold hover:underline"
                  onClick={() => markAllRead(false, ["global-ticket-notifications"])}
                >
                  Marcar tudo como lido
                </button>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {(!ticketNotifications || ticketNotifications.length === 0) ? (
                <p className="py-8 text-center text-xs text-text-muted">Nenhuma notificação</p>
              ) : (
                ticketNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`cursor-pointer border-b border-border px-4 py-2.5 last:border-0 hover:bg-surface-hover ${!n.is_read ? "bg-surface-raised/50" : ""}`}
                    onClick={() => { markOneRead(n.id, ["global-ticket-notifications"], false); setOpenTickets(false); goToChamados(); }}
                  >
                    <p className="text-sm text-text-primary">{n.title}</p>
                    {n.message && <p className="mt-0.5 text-xs text-text-muted line-clamp-2">{n.message}</p>}
                    <p className="mt-1 text-[10px] text-text-muted">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
