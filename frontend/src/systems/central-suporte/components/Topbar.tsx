import { useEffect, useRef, useState } from "react";
import {
  Home,
  List,
  Monitor,
  PlusCircle,
  BarChart3,
  ShieldAlert,
  FileText,
  Search,
  ListChecks,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useNavigate, useLocation } from "@suporte/lib/router-shim";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { NotificationBell } from "@suporte/components/NotificationBell";
import { endUnifiedSession } from "@/lib/unifiedAuth";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@suporte/lib/utils";

const directItems = [
  { title: "Portal do Usuário", url: "/portal", icon: Home, end: true },
  { title: "Meus Chamados", url: "/portal/my-tickets", icon: List, end: false },
];

const openTicketItems = [
  { title: "Chamados TI", url: "/portal/new-ticket-ti", icon: Monitor },
  { title: "Chamado Interno", url: "/portal/new-ticket", icon: PlusCircle },
];

const managementItems = [
  { title: "Painel de Chamados", url: "/admin/kanban", icon: BarChart3 },
  { title: "Incidentes", url: "/admin/incidents", icon: ShieldAlert },
  { title: "Relatórios", url: "/admin/reports", icon: FileText },
  { title: "Consulta de Chamados", url: "/admin/consultation", icon: Search },
  { title: "Tarefas", url: "/admin/tasks", icon: ListChecks },
];

const STAFF_ROLES = [
  "support_agent", "dev", "admin_ti", "coordinator", "viewer",
  "coordinator_sp", "coordinator_sc", "coordinator_sf", "coordinator_fn", "coordinator_rh",
  "direction", "dp", "fiscal", "contabil", "financeiro", "societario", "recepcao", "rh",
];

function isItemActive(pathname: string, url: string, end?: boolean) {
  return pathname === url || (!end && pathname.startsWith(url + "/"));
}

export function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const crmUser = useAuthStore((state) => state.user);
  const mockMode = import.meta.env.VITE_USE_MOCK === "true";

  const [openDropdown, setOpenDropdown] = useState<"open-ticket" | "management" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data?.map((r) => r.role) || [];
    },
    enabled: !mockMode,
  });

  const isMockAdmin = mockMode && crmUser?.perfil === "ADMIN";
  const isAdmin = isMockAdmin || userRoles?.some((role) => STAFF_ROLES.includes(role));
  const isViewerOnly = userRoles?.includes("viewer") && !userRoles?.some((r) =>
    STAFF_ROLES.filter((s) => s !== "viewer").includes(r)
  );

  const visibleManagementItems = isViewerOnly
    ? managementItems.filter((item) => ["/admin/kanban", "/admin/reports", "/admin/tasks"].includes(item.url))
    : managementItems;

  const handleLogout = async () => {
    await endUnifiedSession();
    window.location.href = "/login";
  };

  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenDropdown(null);
        setMobileOpen(false);
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const openTicketActive = openTicketItems.some((i) => isItemActive(location.pathname, i.url));
  const managementActive = visibleManagementItems.some((i) => isItemActive(location.pathname, i.url));

  const activeOpenTicketItem = openTicketItems.find((i) => isItemActive(location.pathname, i.url));
  const activeManagementItem = visibleManagementItems.find((i) => isItemActive(location.pathname, i.url));

  const itemClasses = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-md px-3 h-11 text-sm whitespace-nowrap shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400",
      active ? "text-amber-400 bg-neutral-800" : "text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/60"
    );

  return (
    <nav
      ref={navRef}
      aria-label="Navegação do Sistema de Chamados"
      className="sticky top-0 z-30 w-full bg-neutral-950/95 backdrop-blur border-b border-neutral-800"
    >
      <div className="grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-1 px-3 h-14">
        {/* Mobile hamburger */}
        <button
          type="button"
          className="lg:hidden flex items-center justify-center h-11 w-11 rounded-md text-neutral-300 hover:bg-neutral-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
          aria-controls="chamados-mobile-menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="hidden lg:block" />

        {/* Desktop nav (centralizado) */}
        <div className="hidden lg:flex items-center justify-center gap-1 min-w-0">
          {directItems.map((item) => (
            <button
              key={item.url}
              type="button"
              className={itemClasses(isItemActive(location.pathname, item.url, item.end))}
              onClick={() => navigate(item.url)}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </button>
          ))}

          {/* Abrir chamado dropdown */}
          <div className="relative">
            <button
              type="button"
              className={itemClasses(openTicketActive)}
              aria-haspopup="true"
              aria-expanded={openDropdown === "open-ticket"}
              onClick={() =>
                setOpenDropdown((d) => (d === "open-ticket" ? null : "open-ticket"))
              }
            >
              <PlusCircle className="h-4 w-4" />
              Abrir chamado
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {openDropdown === "open-ticket" && (
              <div className="absolute left-0 top-full mt-1 min-w-[220px] rounded-md border border-neutral-800 bg-neutral-900 shadow-xl py-1 z-40">
                {openTicketItems.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 h-11 text-sm text-left whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400",
                      isItemActive(location.pathname, item.url)
                        ? "text-amber-400 bg-neutral-800"
                        : "text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/60"
                    )}
                    onClick={() => navigate(item.url)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Gestão dropdown (admin only) */}
          {isAdmin && (
            <div className="relative">
              <button
                type="button"
                className={itemClasses(managementActive)}
                aria-haspopup="true"
                aria-expanded={openDropdown === "management"}
                onClick={() =>
                  setOpenDropdown((d) => (d === "management" ? null : "management"))
                }
              >
                <BarChart3 className="h-4 w-4" />
                {managementActive && activeManagementItem
                  ? `Gestão: ${activeManagementItem.title}`
                  : "Gestão"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {openDropdown === "management" && (
                <div className="absolute left-0 top-full mt-1 min-w-[240px] rounded-md border border-neutral-800 bg-neutral-900 shadow-xl py-1 z-40">
                  {visibleManagementItems.map((item) => (
                    <button
                      key={item.url}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-3 h-11 text-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400",
                        isItemActive(location.pathname, item.url)
                          ? "text-amber-400 bg-neutral-800"
                          : "text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/60"
                      )}
                      onClick={() => navigate(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:hidden" />

        <div className="flex items-center justify-end gap-1">
          <NotificationBell />
          <button
            type="button"
            className="hidden lg:flex items-center justify-center h-11 w-11 rounded-md text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            onClick={() => navigate("/admin/settings")}
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Configurações</span>
          </button>
          <button
            type="button"
            className="flex items-center justify-center h-11 w-11 rounded-md text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            onClick={handleLogout}
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sair</span>
          </button>
        </div>
      </div>

      {/* Mobile flat menu */}
      {mobileOpen && (
        <div id="chamados-mobile-menu" className="lg:hidden border-t border-neutral-800 px-2 py-2 space-y-1">
          {directItems.map((item) => (
            <button
              key={item.url}
              type="button"
              className={cn(itemClasses(isItemActive(location.pathname, item.url, item.end)), "w-full justify-start")}
              onClick={() => navigate(item.url)}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </button>
          ))}

          <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Abrir chamado
          </p>
          {openTicketItems.map((item) => (
            <button
              key={item.url}
              type="button"
              className={cn(itemClasses(isItemActive(location.pathname, item.url)), "w-full justify-start")}
              onClick={() => navigate(item.url)}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </button>
          ))}

          {isAdmin && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Gestão
              </p>
              {visibleManagementItems.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  className={cn(itemClasses(isItemActive(location.pathname, item.url)), "w-full justify-start")}
                  onClick={() => navigate(item.url)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </button>
              ))}
            </>
          )}

          <button
            type="button"
            className={cn(itemClasses(isItemActive(location.pathname, "/admin/settings")), "w-full justify-start")}
            onClick={() => navigate("/admin/settings")}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </button>
        </div>
      )}
    </nav>
  );
}
