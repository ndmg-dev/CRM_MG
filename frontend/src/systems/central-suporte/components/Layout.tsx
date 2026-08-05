import { useEffect } from "react";
import { Topbar } from "@suporte/components/Topbar";
import { Outlet, useNavigate, useLocation } from "@suporte/lib/router-shim";
import { useUserSector } from "@suporte/hooks/useUserSector";
import { supabase } from "@suporte/integrations/supabase/client";

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
          if (location.pathname !== "/admin/kanban") {
            navigate("/admin/kanban");
          }
          if ((window as any).__viewerCarouselReset) {
            (window as any).__viewerCarouselReset();
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


