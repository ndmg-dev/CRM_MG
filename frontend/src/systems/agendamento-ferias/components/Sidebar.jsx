import { useEffect, useState } from "react";
import { Link, useLocation } from "../lib/router-shim";
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
} from "lucide-react";

export default function Sidebar() {
  const [contagem, setContagem] = useState(0);
  const location = useLocation();
  const { usuarioLogado } = useAuth();
  const permissions = getFeriasPermissions(usuarioLogado);

  useEffect(() => {
    const atualizarContagem = async () => {
      try {
        const { count, error } = await supabase
          .from("solicitacoes")
          .select("*", { count: "exact", head: true })
          .eq("status", "Pendente"); // <-- Corrigido para "Pendente" com P maiúsculo (como você salvou no banco)

        if (!error) setContagem(count || 0);
      } catch (err) {
        console.error("Erro ao buscar contagem:", err);
      }
    };

    atualizarContagem();

    const canal = supabase
      .channel("sidebar-changes")
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

  const menuItems = [
    { name: "Dashboard", path: "/", icon: <LayoutDashboard size={20} /> },
    { name: "Calendário", path: "/calendario", icon: <Calendar size={20} /> },
    {
      name: "Solicitações",
      path: "/solicitacoes",
      icon: <FileText size={20} />,
      badge: true,
    },
    {
      name: "Colaboradores",
      path: "/colaboradores",
      icon: <Users size={20} />,
      restritoAnalista: true, // Bloqueia para analistas
    },
    {
      name: "Usuários",
      path: "/usuarios",
      icon: <UserCog size={20} />,
      adminOnly: true,
    },
    {
      name: "Configurações",
      path: "/configuracoes",
      icon: <Settings size={20} />,
      configOnly: true,
    },
  ];

  // 🚀 NOVA REGRA INTELIGENTE DE PERMISSÕES
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

  return (
    <aside className="w-64 h-screen bg-[#0a0a0a] text-gray-400 flex flex-col border-r border-[#262626] sticky top-0">
      <div className="flex min-h-20 items-center border-b border-[#262626] px-6">
        <h1 className="text-sm font-bold uppercase tracking-wider text-white">
          Agendamento de Férias
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        {menusPermitidos.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors group ${
                isActive
                  ? "bg-gold/10 text-gold font-medium"
                  : "hover:bg-[#1a1a1a] hover:text-white"
              }`}
            >
              <span
                className={
                  isActive
                    ? "text-gold"
                    : "text-gray-500 group-hover:text-white"
                }
              >
                {item.icon}
              </span>
              <span className="text-sm">{item.name}</span>

              {item.badge && contagem > 0 && (
                <span className="ml-auto bg-gold text-[#0a0a0a] text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {contagem}
                </span>
              )}

              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold"></div>
              )}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
