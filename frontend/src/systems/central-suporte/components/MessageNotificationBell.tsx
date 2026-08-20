import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@suporte/components/ui/button";
import { Badge } from "@suporte/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@suporte/components/ui/popover";
import { ScrollArea } from "@suporte/components/ui/scroll-area";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { playNotificationSound } from "@suporte/lib/notification-sound";
import { showBrowserNotification } from "@suporte/hooks/useBrowserNotifications";
import { useNavigate } from "@suporte/lib/router-shim";

const MESSAGE_TITLE = "Novo comentário";

export function MessageNotificationBell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["message-notifications"],
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

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  useEffect(() => {
    const setupChannel = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel("user-message-notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            const record = payload?.new;
            if (!record?.title?.includes(MESSAGE_TITLE)) return;

            queryClient.invalidateQueries({ queryKey: ["message-notifications"] });
            playNotificationSound("comment_received");
            showBrowserNotification(record.title || "Nova mensagem", record.message || "");
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

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["message-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["unread-comment-counts"] });
  };

  const markAllAsRead = async () => {
    const unread = notifications?.filter((n) => !n.is_read);
    if (!unread?.length) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unread.map((n) => n.id));
    queryClient.invalidateQueries({ queryKey: ["message-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["unread-comment-counts"] });
  };

  const handleClick = (notification: any) => {
    markAsRead(notification.id);
    setOpen(false);
    if (notification.ticket_id) {
      navigate("/admin/kanban");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Mensagens">
          <MessageSquare className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="font-semibold text-sm">Mensagens</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
              Marcar tudo como lido
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[300px]">
          {(!notifications || notifications.length === 0) ? (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhuma mensagem</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-3 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-accent/10 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                onClick={() => handleClick(n)}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className={!n.is_read ? "" : "ml-4"}>
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
