import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { Button } from "@suporte/components/ui/button";
import { Input } from "@suporte/components/ui/input";
import { Label } from "@suporte/components/ui/label";
import { Textarea } from "@suporte/components/ui/textarea";
import { Switch } from "@suporte/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@suporte/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@suporte/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Badge } from "@suporte/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarClock, X } from "lucide-react";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

interface ChecklistItem {
  text: string;
}

interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  day_of_week: number[];
  scheduled_time: string;
  checklist_items: ChecklistItem[];
  is_active: boolean;
  created_at: string | null;
  assignee?: { full_name: string | null; email: string } | null;
}

const dayLabels: Record<number, string> = {
  0: "Domingo", 1: "Segunda", 2: "Terça", 3: "Quarta",
  4: "Quinta", 5: "Sexta", 6: "Sábado",
};

export function RoutineTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskTemplate | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [scheduledTime, setScheduledTime] = useState("08:00");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("*, assignee:profiles!assignee_id(full_name, email)")
        .order("day_of_week", { ascending: true });
      if (error) throw error;
      return (data || []).map((t: any) => ({ ...t, checklist_items: (t.checklist_items || []) as ChecklistItem[] })) as TaskTemplate[];
    },
  });

  const { data: staffProfiles } = useQuery({
    queryKey: ["staff-profiles-for-tasks"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["support_agent", "dev", "admin_ti", "coordinator"]);
      if (!roles?.length) return [];
      const ids = [...new Set(roles.map(r => r.user_id))];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        assignee_id: assigneeId || null,
        day_of_week: daysOfWeek,
        scheduled_time: scheduledTime,
        checklist_items: checklistItems as any,
        is_active: isActive,
      };
      if (editing) {
        const { error } = await supabase.from("task_templates").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("task_templates").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Rotina atualizada" : "Rotina criada");
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rotina removida");
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const openNew = () => {
    setEditing(null);
    setTitle(""); setDescription(""); setAssigneeId(""); setDaysOfWeek([1]);
    setScheduledTime("08:00"); setChecklistItems([]); setNewCheckItem(""); setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (t: TaskTemplate) => {
    setEditing(t);
    setTitle(t.title);
    setDescription(t.description || "");
    setAssigneeId(t.assignee_id || "");
    setDaysOfWeek(Array.isArray(t.day_of_week) ? t.day_of_week : [t.day_of_week]);
    setScheduledTime(t.scheduled_time?.slice(0, 5) || "08:00");
    setChecklistItems(t.checklist_items || []);
    setNewCheckItem("");
    setIsActive(t.is_active);
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklistItems(prev => [...prev, { text: newCheckItem.trim() }]);
    setNewCheckItem("");
  };

  const removeCheckItem = (idx: number) => {
    setChecklistItems(prev => prev.filter((_, i) => i !== idx));
  };

  const canSave = title.trim() && scheduledTime && daysOfWeek.length > 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> Rotinas Programadas
            </CardTitle>
            <CardDescription>Configure tarefas recorrentes que são criadas automaticamente</CardDescription>
          </div>
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova Rotina
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma rotina cadastrada.</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Dia</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Checklist</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell>{(Array.isArray(t.day_of_week) ? t.day_of_week : [t.day_of_week]).map(d => dayLabels[d]).join(", ")}</TableCell>
                      <TableCell>{t.scheduled_time?.slice(0, 5)}</TableCell>
                      <TableCell>{t.assignee?.full_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={t.is_active ? "default" : "secondary"}>
                          {t.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell>{t.checklist_items?.length || 0} itens</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(t)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Rotina" : "Nova Rotina"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Verificação de backups" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes da tarefa..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Dias da Semana *</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(dayLabels).map(([k, v]) => {
                  const day = parseInt(k);
                  const selected = daysOfWeek.includes(day);
                  return (
                    <Button
                      key={k}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setDaysOfWeek(prev =>
                          selected ? prev.filter(d => d !== day) : [...prev, day].sort()
                        )
                      }
                    >
                      {v.slice(0, 3)}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Horário *</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={assigneeId || "none"} onValueChange={(v) => setAssigneeId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {staffProfiles?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Checklist</Label>
              <div className="space-y-2">
                {checklistItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm bg-muted/50 rounded p-2">
                    <span className="flex-1">{item.text}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeCheckItem(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newCheckItem}
                    onChange={(e) => setNewCheckItem(e.target.value)}
                    placeholder="Novo item..."
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheckItem(); } }}
                  />
                  <Button variant="outline" size="sm" onClick={addCheckItem} disabled={!newCheckItem.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="active" className="text-sm">Rotina ativa</Label>
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
        title="Remover Rotina"
        description={`Deseja remover a rotina "${deleteTarget?.title}"? Tarefas já criadas não serão afetadas.`}
      />
    </>
  );
}

