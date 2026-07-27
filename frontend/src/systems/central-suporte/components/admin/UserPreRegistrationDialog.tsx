import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@suporte/components/ui/dialog";
import { Button } from "@suporte/components/ui/button";
import { Checkbox } from "@suporte/components/ui/checkbox";
import { Input } from "@suporte/components/ui/input";
import { Label } from "@suporte/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { supabase } from "@suporte/integrations/supabase/client";
import { toast } from "sonner";

const availableRoles = [
  ["user", "Usuário"],
  ["support_agent", "Suporte"],
  ["dev", "Desenvolvedor"],
  ["admin_ti", "Admin TI"],
  ["coordinator", "Coordenador TI"],
  ["coordinator_sp", "Coordenador SP"],
  ["coordinator_sc", "Coordenador SC"],
  ["coordinator_sf", "Coordenador SF"],
  ["coordinator_fn", "Coordenador FN"],
  ["coordinator_rh", "Coordenador RH"],
  ["direction", "Direção"],
  ["dp", "DP"],
  ["fiscal", "Fiscal"],
  ["contabil", "Contábil"],
  ["financeiro", "Financeiro"],
  ["societario", "Societário"],
  ["recepcao", "Recepção"],
  ["rh", "RH"],
  ["viewer", "Visualizador"],
] as const;

type AppRole = typeof availableRoles[number][0];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectors: Array<{ id: string; name: string }>;
}

export function UserPreRegistrationDialog({ open, onOpenChange, sectors }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [roles, setRoles] = useState<AppRole[]>(["user"]);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setFullName("");
    setEmail("");
    setSectorId("");
    setRoles(["user"]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const toggleRole = (role: AppRole) => {
    setRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  };

  const save = async () => {
    if (!fullName.trim() || !email.trim() || !sectorId) {
      toast.error("Preencha nome, e-mail e setor.");
      return;
    }
    if (roles.length === 0) {
      toast.error("Selecione ao menos um perfil.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("admin_pre_register_support_user", {
        _email: email.trim().toLowerCase(),
        _full_name: fullName.trim(),
        _sector_id: sectorId,
        _roles: roles,
      });
      if (error) throw error;
      toast.success("Pré-cadastro salvo. O acesso será ativado no primeiro login.");
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao pré-cadastrar usuário.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Pré-cadastrar usuário</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="pre-name">Nome completo</Label>
            <Input id="pre-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pre-email">E-mail corporativo</Label>
            <Input id="pre-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
              <SelectContent>
                {sectors.map((sector) => (
                  <SelectItem key={sector.id} value={sector.id}>{sector.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Perfis de acesso</Label>
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
              {availableRoles.map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2">
                  <Checkbox checked={roles.includes(value)} onCheckedChange={() => toggleRole(value)} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O usuário aparecerá na lista após entrar pela primeira vez com este e-mail.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={save} disabled={loading}>{loading ? "Salvando..." : "Salvar pré-cadastro"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
