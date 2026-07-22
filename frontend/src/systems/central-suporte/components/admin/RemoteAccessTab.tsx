import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { Button } from "@suporte/components/ui/button";
import { Input } from "@suporte/components/ui/input";
import { Label } from "@suporte/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@suporte/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@suporte/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Monitor, Eye, EyeOff, Copy } from "lucide-react";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

interface Device {
  id: string;
  user_name: string;
  machine_name: string;
  anydesk_id: string;
  anydesk_password: string;
  user_id: string | null;
  created_at: string | null;
}

interface RemoteAccessTabProps {
  userOnly?: boolean;
}

export function RemoteAccessTab({ userOnly = false }: RemoteAccessTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const [selectedUserId, setSelectedUserId] = useState("");
  const [machineName, setMachineName] = useState("");
  const [anydeskId, setAnydeskId] = useState("");
  const [anydeskPassword, setAnydeskPassword] = useState("");

  const queryClient = useQueryClient();

  const { data: currentUserId } = useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
  });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["remote-access-devices", userOnly, currentUserId],
    queryFn: async () => {
      let query = supabase
        .from("remote_access_devices")
        .select("*")
        .order("user_name", { ascending: true });

      if (userOnly && currentUserId) {
        query = query.eq("user_id", currentUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Device[];
    },
    enabled: !userOnly || !!currentUserId,
  });

  // Fetch all profiles for the user selector (admin only)
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles-for-remote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !userOnly,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedProfile = allProfiles.find(p => p.id === selectedUserId);
      const payload: any = {
        user_name: selectedProfile?.full_name || selectedProfile?.email || "",
        machine_name: machineName.trim(),
        anydesk_id: anydeskId.trim(),
        anydesk_password: anydeskPassword.trim(),
        user_id: selectedUserId || null,
      };
      if (editingDevice) {
        const { error } = await supabase
          .from("remote_access_devices")
          .update(payload)
          .eq("id", editingDevice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("remote_access_devices")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingDevice ? "Dispositivo atualizado" : "Dispositivo adicionado");
      queryClient.invalidateQueries({ queryKey: ["remote-access-devices"] });
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("remote_access_devices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dispositivo removido");
      queryClient.invalidateQueries({ queryKey: ["remote-access-devices"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const openNew = () => {
    setEditingDevice(null);
    setSelectedUserId("");
    setMachineName("");
    setAnydeskId("");
    setAnydeskPassword("");
    setDialogOpen(true);
  };

  const openEdit = (d: Device) => {
    setEditingDevice(d);
    setSelectedUserId(d.user_id || "");
    setMachineName(d.machine_name);
    setAnydeskId(d.anydesk_id);
    setAnydeskPassword(d.anydesk_password);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingDevice(null);
  };

  const togglePassword = (id: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const canSave = selectedUserId && machineName.trim() && anydeskId.trim() && anydeskPassword.trim();

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" /> Acesso Remoto
            </CardTitle>
            <CardDescription>
              {userOnly ? "Seus dados de acesso remoto (AnyDesk)" : "Gerencie os dados de acesso remoto (AnyDesk) dos dispositivos"}
            </CardDescription>
          </div>
          {!userOnly && (
            <Button onClick={openNew} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dispositivo cadastrado.</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>ID AnyDesk</TableHead>
                    <TableHead>Senha</TableHead>
                    {!userOnly && <TableHead className="w-[100px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.user_name}</TableCell>
                      <TableCell>{d.machine_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm">{d.anydesk_id}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(d.anydesk_id, "ID")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm">
                            {visiblePasswords.has(d.id) ? d.anydesk_password : "••••••"}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePassword(d.id)}>
                            {visiblePasswords.has(d.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(d.anydesk_password, "Senha")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      {!userOnly && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(d)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!userOnly && (
        <>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingDevice ? "Editar Dispositivo" : "Novo Dispositivo"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Usuário *</Label>
                  <Select value={selectedUserId || "none"} onValueChange={(v) => setSelectedUserId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o usuário..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>Selecione o usuário...</SelectItem>
                      {allProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ra-machine">Nome da Máquina</Label>
                  <Input id="ra-machine" value={machineName} onChange={(e) => setMachineName(e.target.value)} placeholder="Ex: PC-JOAO-01" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ra-id">ID AnyDesk</Label>
                  <Input id="ra-id" value={anydeskId} onChange={(e) => setAnydeskId(e.target.value)} placeholder="Ex: 123 456 789" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ra-pass">Senha AnyDesk</Label>
                  <Input id="ra-pass" value={anydeskPassword} onChange={(e) => setAnydeskPassword(e.target.value)} placeholder="Senha de acesso" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DeleteConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
            onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            title="Remover Dispositivo"
            description={`Deseja remover o dispositivo "${deleteTarget?.machine_name}"?`}
          />
        </>
      )}
    </>
  );
}

