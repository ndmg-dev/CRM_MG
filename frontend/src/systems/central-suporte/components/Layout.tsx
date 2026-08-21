import { useEffect } from "react";
import { Topbar } from "@suporte/components/Topbar";
import { Outlet, useNavigate, useLocation } from "@suporte/lib/router-shim";
import { useUserSector } from "@suporte/hooks/useUserSector";
import { supabase } from "@suporte/integrations/supabase/client";
import { playNotificationSound } from "@suporte/lib/notification-sound";

const CLOSED_TICKET_STATUSES = ["resolved", "closed", "canceled"];

const Layout = () => {
  const { isViewer, roles } = useUserSector();
  const navigate = useNavigate();
  const location = useLocation();
  // Viewer "puro" (TV) — sem cargo de staff também atribuído.
  const isPureViewer = isViewer && !roles.some((r) => ["support_agent", "dev", "admin_ti"].includes(r));

  // TV do viewer: chegou chamado novo, volta pra tela principal na hora,
  // não importa em qual aba/tela o viewer estava.
  useEffect(() => {
    if (!isPureViewer) return;

    const channel = supabase
      .channel("layout-viewer-new-ticket")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        () => {
          // Viewer não é "alvo" de linhas em `notifications` (isso é por
          // responsável), então o som não pode depender do NotificationBell
          // — toca direto aqui pra qualquer chamado novo, sempre.
          playNotificationSound("ticket_opened");
          if (location.pathname !== "/admin/kanban") {
            navigate("/admin/kanban");
          }
          if ((window as any).__viewerCarouselReset) {
            (window as any).__viewerCarouselReset();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets" },
        (payload: any) => {
          // Mesmo motivo do INSERT acima: som direto, sem depender de
          // `notifications` (viewer não é alvo de linha nenhuma lá).
          const wasClosed = CLOSED_TICKET_STATUSES.includes(payload.old?.status);
          const isClosed = CLOSED_TICKET_STATUSES.includes(payload.new?.status);
          if (!wasClosed && isClosed) {
            playNotificationSound("ticket_closed");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPureViewer, location.pathname, navigate]);

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <Topbar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 lg:p-8 w-full space-y-8 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;


