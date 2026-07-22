import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Button } from "@suporte/components/ui/button";
import { Badge } from "@suporte/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { UserEditDialog } from "./UserEditDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { toast } from "sonner";
import { useUserSector } from "@suporte/hooks/useUserSector";

const roleLabels: Record<string, string> = {
  user: "Usuário",
  support_agent: "Suporte",
  dev: "Desenvolvedor",
  admin_ti: "Admin TI",
  coordinator: "Coordenador TI",
  coordinator_sp: "Coordenador SP",
  coordinator_sc: "Coordenador SC",
  coordinator_sf: "Coordenador SF",
  coordinator_fn: "Coordenador FN",
  coordinator_rh: "Coordenador RH",
  direction: "Direção",
  dp: "DP",
  fiscal: "Fiscal",
  contabil: "Contábil",
  financeiro: "Financeiro",
  societario: "Societário",
  recepcao: "Recepção",
  rh: "RH",
  viewer: "Visualizador",
};

const roleBadgeClass: Record<string, string> = {
  user: "bg-secondary text-secondary-foreground",
  support_agent: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  dev: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  admin_ti: "bg-primary/20 text-primary border-primary/30",
  coordinator: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  coordinator_sp: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  coordinator_sc: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  coordinator_sf: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  coordinator_fn: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  coordinator_rh: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  direction: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  dp: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  fiscal: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  contabil: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  financeiro: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  societario: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  recepcao: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  rh: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  viewer: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

interface UsersTabProps {
  readOnly?: boolean;
}

export function UsersTab({ readOnly }: UsersTabProps) {
  const userSector = useUserSector();

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");
      if (rolesError) throw rolesError;

      return profiles.map((p) => ({
        ...p,
        roles: roles.filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  // Filter users based on current user's role & sector
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    // Direction & Admin TI: see all users
    if (userSector.isDirection || userSector.isAdmin) return users;
    // Coordinator or Viewer: see users in same sector
    if ((userSector.isCoordinator || userSector.isViewer) && userSector.sectorId) {
      return users.filter(u => u.sector_id === userSector.sectorId);
    }
    // Regular staff: see users in same sector (including coordinator)
    if (userSector.sectorId) {
      return users.filter(u => u.sector_id === userSector.sectorId);
    }
    // Fallback: only self
    return users.filter(u => u.id === userSector.userId);
  }, [users, userSector]);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const queryClient = useQueryClient();

  const sectorMap = sectors ? Object.fromEntries(sectors.map(s => [s.id, s.name])) : {};

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.rpc("admin_delete_user", { _user_id: deletingUser.id });
      if (error) throw error;
      toast.success("Usuário excluído");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir usuário");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gestão de Usuários</CardTitle>
            <CardDescription>Gerencie acessos, setores e permissões do sistema</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Carregando...</p>
          ) : filteredUsers.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">E-mail</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Setor</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Perfil</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Cadastro</th>
                    {!readOnly && <th className="text-right p-3 text-sm font-medium text-muted-foreground">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {user.full_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <span className="text-sm font-medium">{user.full_name || "—"}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{user.email}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {user.sector_id ? (
                          <Badge variant="outline">{sectorMap[user.sector_id] || "—"}</Badge>
                        ) : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {user.roles.length > 0 ? user.roles.map((role: string) => (
                            <Badge key={role} variant="outline" className={roleBadgeClass[role] || ""}>
                              {roleLabels[role] || role}
                            </Badge>
                          )) : (
                            <span className="text-xs text-muted-foreground">Sem perfil</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      {!readOnly && (
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setEditingUser(user); setEditDialogOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => { setDeletingUser(user); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border p-4 text-center text-muted-foreground">
              Nenhum usuário cadastrado
            </div>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <>
          <UserEditDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} user={editingUser} />
          <DeleteConfirmDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title="Excluir Usuário"
            description={`Tem certeza que deseja excluir "${deletingUser?.full_name || deletingUser?.email}"? Esta ação não pode ser desfeita.`}
            onConfirm={handleDelete}
            loading={deleteLoading}
          />
        </>
      )}
    </>
  );
}

