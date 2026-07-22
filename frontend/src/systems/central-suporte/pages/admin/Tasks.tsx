import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Badge } from "@suporte/components/ui/badge";
import { Button } from "@suporte/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@suporte/components/ui/table";
import { CheckCircle2, Clock, ListTodo, Filter } from "lucide-react";
import { TaskDetailDialog } from "@suporte/components/admin/TaskDetailDialog";
import { useUserSector } from "@suporte/hooks/useUserSector";

interface ChecklistItem {
  text: string;
  checked: boolean;
}

const Tasks = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const sector = useUserSector();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["task-instances", sector.visibleSectorId],
    queryFn: async () => {
      let query = supabase
        .from("task_instances")
        .select("*, assignee:profiles!assignee_id(full_name, email, sector_id)")
        .order("created_at", { ascending: false });
      
      // Filter tasks by sector: only show tasks where assignee is in user's sector
      const { data, error } = await query;
      if (error) throw error;
      
      if (sector.visibleSectorId) {
        return (data || []).filter(t => 
          (t.assignee as any)?.sector_id === sector.visibleSectorId
        );
      }
      return data || [];
    },
    enabled: sector.roles.length > 0,
  });

  const filtered = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter(t => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const completedCount = tasks.filter(t => t.status === "completed").length;

  if (isLoading) return <div>Carregando tarefas...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tarefas</h2>
          <p className="text-muted-foreground text-sm">Gerencie as tarefas geradas pelas rotinas programadas</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 text-sm">
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" /> {pendingCount} pendentes
            </Badge>
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> {completedCount} concluídas
            </Badge>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTodo className="h-5 w-5" /> Lista de Tarefas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa encontrada.</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Checklist</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[80px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => {
                    const checklist: ChecklistItem[] = (Array.isArray(t.checklist) ? t.checklist : []) as unknown as ChecklistItem[];
                    const done = checklist.filter(c => c.checked).length;
                    const isCompleted = t.status === "completed";
                    return (
                      <TableRow
                        key={t.id}
                        className={`cursor-pointer ${isCompleted ? "opacity-60" : ""}`}
                        onClick={() => setSelectedTaskId(t.id)}
                      >
                        <TableCell>
                          <Badge variant={isCompleted ? "default" : "secondary"}>
                            {isCompleted ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Concluída</>
                            ) : (
                              <><Clock className="h-3 w-3 mr-1" /> Pendente</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className={`font-medium ${isCompleted ? "line-through" : ""}`}>
                          {t.title}
                        </TableCell>
                        <TableCell>{t.assignee?.full_name || "—"}</TableCell>
                        <TableCell>
                          {checklist.length > 0 ? (
                            <span className="text-sm">{done}/{checklist.length}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(t.created_at!).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedTaskId(t.id)}>
                            Abrir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TaskDetailDialog
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </div>
  );
};

export default Tasks;

