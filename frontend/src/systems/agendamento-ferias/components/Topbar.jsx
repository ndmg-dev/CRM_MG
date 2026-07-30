import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "../lib/router-shim";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { getFeriasPermissions } from "../lib/permissions";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Users,
  UserCog,
  Settings,
  Menu,
  X,
} from "lucide-react";

const menuItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard, end: true },
  { name: "Calendário", path: "/calendario", icon: Calendar },
  { name: "Solicitações", path: "/solicitacoes", icon: FileText, badge: true },
  { name: "Colaboradores", path: "/colaboradores", icon: Users, restritoAnalista: true },
  { name: "Usuários", path: "/usuarios", icon: UserCog, adminOnly: true },
  { name: "Configurações", path: "/configuracoes", icon: Settings, configOnly: true },
];

function isItemActive(pathname, path, end) {
  return pathname === path || (!end && path !== "/" && pathname.startsWith(path + "/"));
}

export default function Topbar() {
  const [contagem, setContagem] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { usuarioLogado } = useAuth();
  const permissions = getFeriasPermissions(usuarioLogado);
  const navRef = useRef(null);

  useEffect(() => {
    const atualizarContagem = async () => {
      try {
        const { count, error } = await supabase
          .from("solicitacoes")
          .select("*", { count: "exact", head: true })
          .eq("status", "Pendente");

        if (!error) setContagem(count || 0);
      } catch (err) {
        console.error("Erro ao buscar contagem:", err);
      }
    };

    atualizarContagem();

    const canal = supabase
      .channel("topbar-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes" },
        () => atualizarContagem(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const menusPermitidos = menuItems.filter((item) => {
    if (!usuarioLogado?.perfil) return false;
    if (item.adminOnly) return permissions.canManageUsers;
    if (item.configOnly) return permissions.canConfigure;
    if (item.restritoAnalista) return !permissions.isAnalyst;
    return permissions.isAdmin
      || permissions.isManager
      || permissions.isCoordinator
      || permissions.isAnalyst;
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    function onPointerDown(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const itemClasses = (active) =>
    `flex items-center gap-2 rounded-md px-3 h-11 text-sm whitespace-nowrap shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
      active ? "text-gold bg-[#1a1a1a] font-medium" : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
    }`;

  return (
    <nav
      ref={navRef}
      aria-label="Navegação do Agendamento de Férias"
      className="sticky top-0 z-30 w-full bg-[#0a0a0a]/95 backdrop-blur border-b border-[#262626]"
    >
      <div className="grid grid-cols-[auto_1fr_auto] lg:grid-cols-3 items-center gap-1 px-3 h-14">
        <button
          type="button"
          className="lg:hidden flex items-center justify-center h-11 w-11 rounded-md text-gray-400 hover:bg-[#1a1a1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
          aria-controls="ferias-mobile-menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="hidden lg:block" />

        <div className="hidden lg:flex items-center justify-center gap-1 min-w-0 overflow-x-auto">
          {menusPermitidos.map((item) => {
            const active = isItemActive(location.pathname, item.path, item.end);
            return (
              <button
                key={item.name}
                type="button"
                className={itemClasses(active)}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
                {item.badge && contagem > 0 && (
                  <span className="bg-gold text-[#0a0a0a] text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {contagem}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="lg:hidden" />
        <div className="hidden lg:block" />
      </div>

      {mobileOpen && (
        <div id="ferias-mobile-menu" className="lg:hidden border-t border-[#262626] px-2 py-2 space-y-1">
          {menusPermitidos.map((item) => {
            const active = isItemActive(location.pathname, item.path, item.end);
            return (
              <button
                key={item.name}
                type="button"
                className={`${itemClasses(active)} w-full justify-start`}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
                {item.badge && contagem > 0 && (
                  <span className="ml-auto bg-gold text-[#0a0a0a] text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {contagem}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
