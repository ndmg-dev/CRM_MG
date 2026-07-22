import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@suporte/components/ui/dialog";
import { Button } from "@suporte/components/ui/button";
import { Input } from "@suporte/components/ui/input";
import { Label } from "@suporte/components/ui/label";
import { Checkbox } from "@suporte/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { supabase } from "@suporte/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const allRoles = [
  { value: "user", label: "Usuário" },
  { value: "support_agent", label: "Suporte" },
  { value: "dev", label: "Desenvolvedor" },
  { value: "admin_ti", label: "Admin TI" },
  { value: "coordinator", label: "Coordenador TI" },
  { value: "coordinator_sp", label: "Coordenador SP" },
  { value: "coordinator_sc", label: "Coordenador SC" },
  { value: "coordinator_sf", label: "Coordenador SF" },
  { value: "coordinator_fn", label: "Coordenador FN" },
  { value: "coordinator_rh", label: "Coordenador RH" },
  { value: "direction", label: "Direção" },
  { value: "dp", label: "DP" },
  { value: "fiscal", label: "Fiscal" },
  { value: "contabil", label: "Contábil" },
  { value: "financeiro", label: "Financeiro" },
  { value: "societario", label: "Societário" },
  { value: "recepcao", label: "Recepção" },
  { value: "rh", label: "RH" },
  { value: "viewer", label: "Visualizador" },
] as const;

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string | null;
    email: string;
    department: string | null;
    sector_id?: string | null;
    roles: string[];
  } | null;
}

export function UserEditDialog({ open, onOpenChange, user }: UserEditDialogProps) {
  const [fullName, setFullName] = useState("");
  const [sectorId, setSectorId] = useState<string>("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setSectorId(user.sector_id || "");
      setSelectedRoles(user.roles);
    }
  }, [user, open]);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (selectedRoles.length === 0) {
      toast.error("Selecione pelo menos um perfil");
      return;
    }
    setLoading(true);
    try {
      // Update roles via RPC
      const { error } = await supabase.rpc("admin_update_user_profile_and_roles", {
        _user_id: user.id,
        _full_name: fullName.trim() || "",
        _department: "",
        _roles: selectedRoles as any,
      });
      if (error) throw error;

      // Update sector separately
      const { error: sectorError } = await supabase
        .from("profiles")
        .update({ sector_id: sectorId && sectorId !== "none" ? sectorId : null })
        .eq("id", user.id);
      if (sectorError) throw sectorError;

      toast.success("Usuário atualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar usuário");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user.email} disabled className="opacity-60" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-name">Nome completo</Label>
            <Input id="user-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome do usuário" />
          </div>
          <div className="space-y-2">
            <Label>Setor</Label>
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem setor</SelectItem>
                  {sectors?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
          <div className="space-y-2">
            <Label>Perfis de acesso</Label>
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {allRoles.map((role) => (
                <label key={role.value} className="flex items-center gap-2 cursor-pointer rounded-md border border-border p-2 hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => toggleRole(role.value)}
                  />
                  <span className="text-sm">{role.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

