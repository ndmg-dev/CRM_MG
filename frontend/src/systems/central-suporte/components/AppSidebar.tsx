import { 
  Home, 
  PlusCircle, 
  List, 
  Kanban, 
  Settings, 
  BarChart3,
  ShieldAlert,
  FileSearch,
  ListTodo,
  Monitor,
} from "lucide-react";
import { Button } from "@suporte/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@suporte/components/ui/sidebar";
import { useNavigate, useLocation } from "@suporte/lib/router-shim";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { endUnifiedSession } from "@/lib/unifiedAuth";
import { useAuthStore } from "@/stores/authStore";

const portalItems = [
  { title: "Portal do Usuário", url: "/portal", icon: Home },
  { title: "Chamados TI", url: "/portal/new-ticket-ti", icon: Monitor },
  { title: "Chamado Interno", url: "/portal/new-ticket", icon: PlusCircle },
  { title: "Meus Chamados", url: "/portal/my-tickets", icon: List },
  { title: "Configurações", url: "/admin/settings", icon: Settings },
];

const managementItems = [
  { title: "Painel de Chamados", url: "/admin/kanban", icon: Kanban },
  { title: "Incidentes", url: "/admin/incidents", icon: ShieldAlert },
  { title: "Relatórios", url: "/admin/reports", icon: BarChart3 },
  { title: "Consulta de Chamados", url: "/admin/consultation", icon: FileSearch },
  { title: "Tarefas", url: "/admin/tasks", icon: ListTodo },
];

// All roles that should see management section
const STAFF_ROLES = [
  "support_agent", "dev", "admin_ti", "coordinator", "viewer",
  "coordinator_sp", "coordinator_sc", "coordinator_sf", "coordinator_fn", "coordinator_rh",
  "direction", "dp", "fiscal", "contabil", "financeiro", "societario", "recepcao", "rh",
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const crmUser = useAuthStore((state) => state.user);
  const mockMode = import.meta.env.VITE_USE_MOCK === "true";

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
  const isStaff = isMockAdmin || userRoles?.some((role) => STAFF_ROLES.includes(role));
  const isViewerOnly = userRoles?.includes("viewer") && !userRoles?.some(r => 
    STAFF_ROLES.filter(s => s !== "viewer").includes(r)
  );

  const visibleManagementItems = isViewerOnly 
    ? managementItems.filter(item => ["/admin/kanban", "/admin/reports", "/admin/tasks"].includes(item.url))
    : managementItems;

  const handleLogout = async () => {
    await endUnifiedSession();
    window.location.href = "/login";
  };

  return (
    <Sidebar contained>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {portalItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    onClick={() => navigate(item.url)}
                    isActive={location.pathname === item.url}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleManagementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      onClick={() => navigate(item.url)}
                      isActive={location.pathname === item.url}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      <SidebarFooter className="p-3">
        <Button
          onClick={handleLogout}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
        >
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}


