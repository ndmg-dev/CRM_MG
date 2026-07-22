import { Tabs, TabsContent, TabsList, TabsTrigger } from "@suporte/components/ui/tabs";
import { CategoriesTab } from "@suporte/components/admin/CategoriesTab";
import { UsersTab } from "@suporte/components/admin/UsersTab";
import { SlaTab } from "@suporte/components/admin/SlaTab";
import { RemoteAccessTab } from "@suporte/components/admin/RemoteAccessTab";
import { RoutineTab } from "@suporte/components/admin/RoutineTab";
import { DisplaySoundTab } from "@suporte/components/admin/DisplaySoundTab";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";

const STAFF_ROLES = [
  "support_agent", "dev", "admin_ti", "coordinator", "viewer",
  "coordinator_sp", "coordinator_sc", "coordinator_sf", "coordinator_fn", "coordinator_rh",
  "direction", "dp", "fiscal", "contabil", "financeiro", "societario", "recepcao", "rh",
];

const AdminSettings = () => {
  const crmUser = useAuthStore((state) => state.user);
  const mockMode = import.meta.env.VITE_USE_MOCK === "true";
  const isArthurSupportAdmin = mockMode
    && crmUser?.email?.trim().toLowerCase() === "arthur.monteiro@mendoncagalvao.com.br";

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data?.map((r) => r.role) || [];
    },
    enabled: !mockMode,
  });

  const effectiveRoles = isArthurSupportAdmin ? ["admin_ti"] : (userRoles || []);
  const isAdmin = effectiveRoles.includes("admin_ti");
  const isStaff = isAdmin || effectiveRoles.some((role) => STAFF_ROLES.includes(role));
  const isBasicUser = !isStaff;

  // Regular users: only Remote Access
  if (isBasicUser) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
          <p className="text-muted-foreground">Seus dados de acesso remoto</p>
        </div>
        <RemoteAccessTab userOnly />
      </div>
    );
  }

  // Non-admin staff: Acesso Remoto, Usuários (somente leitura) e Rotina
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
          <p className="text-muted-foreground">Configurações do sistema</p>
        </div>
        <Tabs defaultValue="remote" className="space-y-4">
          <TabsList>
            <TabsTrigger value="remote">Acesso Remoto</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="routine">Rotina</TabsTrigger>
          </TabsList>
          <TabsContent value="remote" className="space-y-4">
            <RemoteAccessTab />
          </TabsContent>
          <TabsContent value="users" className="space-y-4">
            <UsersTab readOnly />
          </TabsContent>
          <TabsContent value="routine" className="space-y-4">
            <RoutineTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Admin: full access
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">Gerencie usuários, categorias e SLAs</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Usuários e Permissões</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="sla">Políticas de SLA</TabsTrigger>
          <TabsTrigger value="remote">Acesso Remoto</TabsTrigger>
          <TabsTrigger value="routine">Rotina</TabsTrigger>
          <TabsTrigger value="display">Exibição e Sons</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="categories" className="space-y-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="sla" className="space-y-4">
          <SlaTab />
        </TabsContent>
        <TabsContent value="remote" className="space-y-4">
          <RemoteAccessTab />
        </TabsContent>
        <TabsContent value="routine" className="space-y-4">
          <RoutineTab />
        </TabsContent>
        <TabsContent value="display" className="space-y-4">
          <DisplaySoundTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;

