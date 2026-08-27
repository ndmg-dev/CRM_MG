import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { Select } from "@mg/ui";
import { CheckCircle2, Clock, ListTodo } from "lucide-react";
import { TaskDetailDialog } from "@suporte/components/admin/TaskDetailDialog";
import { useUserSector } from "@suporte/hooks/useUserSector";

// Tokens — ver frontend/packages/@mg/tokens/build/tokens.css. Handoff:
// Gestao Tarefas.dc.html.
const GOLD = "var(--mg-color-gold-base)";
const TEXT_PRIMARY = "var(--mg-color-text-primary)";
const TEXT_SECONDARY = "var(--mg-color-text-secondary)";
const TEXT_MUTED = "var(--mg-color-text-muted)";
const BORDER_DEFAULT = "var(--mg-color-border-default)";
const INFO = "var(--mg-color-status-info)";

const CARD_CLASS = "bg-[var(--mg-color-bg-card)] border border-[var(--mg-color-border-default)] rounded-xl";

const FILTER_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "completed", label: "Concluídas" },
];

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

  if (isLoading) return <div style={{ color: TEXT_MUTED }}>Carregando tarefas...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ color: TEXT_PRIMARY, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Tarefas</h1>
          <p style={{ color: TEXT_SECONDARY, fontSize: 13, margin: 0 }}>Gerencie as tarefas geradas pelas rotinas programadas</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5" style={{ height: 32, padding: "0 12px", background: "var(--mg-color-bg-card)", border: `0.5px solid ${BORDER_DEFAULT}`, borderRadius: 999, fontSize: 12.5, color: TEXT_SECONDARY }}>
            <Clock className="h-3 w-3" /> {pendingCount} pendentes
          </span>
          <span className="flex items-center gap-1.5" style={{ height: 32, padding: "0 12px", background: "rgba(210,170,63,0.12)", border: "0.5px solid var(--mg-color-gold-border)", borderRadius: 999, fontSize: 12.5, color: GOLD, fontWeight: 600 }}>
            <CheckCircle2 className="h-3 w-3" /> {completedCount} concluídas
          </span>
          <Select options={FILTER_OPTIONS} value={statusFilter} onValueChange={setStatusFilter} aria-label="Filtrar tarefas" />
        </div>
      </div>

      <div className={CARD_CLASS} style={{ overflow: "hidden" }}>
        <div className="flex items-center gap-2" style={{ padding: "16px 18px", borderBottom: `0.5px solid ${BORDER_DEFAULT}`, fontSize: 14.5, fontWeight: 700, color: TEXT_PRIMARY }}>
          <ListTodo className="h-4 w-4" style={{ color: GOLD }} /> Lista de Tarefas
        </div>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "32px 0" }}>Nenhuma tarefa encontrada.</p>
        ) : (
          <>
            <div className="hidden md:grid" style={{ gridTemplateColumns: "110px 1fr 160px 90px 120px 70px", padding: "12px 18px", fontSize: 12, color: TEXT_SECONDARY, borderBottom: `0.5px solid ${BORDER_DEFAULT}` }}>
              <div>Status</div><div>Título</div><div>Responsável</div><div>Checklist</div><div>Data</div><div>Ação</div>
            </div>
            {filtered.map((t) => {
              const checklist: ChecklistItem[] = (Array.isArray(t.checklist) ? t.checklist : []) as unknown as ChecklistItem[];
              const done = checklist.filter(c => c.checked).length;
              const isCompleted = t.status === "completed";
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className="grid grid-cols-1 md:grid-cols-[110px_1fr_160px_90px_120px_70px] items-center hover:bg-[var(--mg-color-bg-hover)] cursor-pointer gap-1 md:gap-0"
                  style={{ padding: "14px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}
                >
                  <div>
                    <span
                      className="flex items-center gap-1.5"
                      style={{
                        display: "inline-flex", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: isCompleted ? "rgba(210,170,63,0.12)" : "rgba(92,148,239,0.12)",
                        color: isCompleted ? GOLD : INFO,
                      }}
                    >
                      {isCompleted ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                      {isCompleted ? "Concluída" : "Pendente"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: isCompleted ? TEXT_MUTED : TEXT_PRIMARY, textDecoration: isCompleted ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>{t.assignee?.full_name || "—"}</div>
                  <div style={{ fontSize: 13, color: checklist.length && done === 0 ? TEXT_MUTED : TEXT_SECONDARY }}>
                    {checklist.length > 0 ? `${done}/${checklist.length}` : "—"}
                  </div>
                  <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>{new Date(t.created_at!).toLocaleDateString("pt-BR")}</div>
                  <div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedTaskId(t.id); }}
                      style={{ background: "none", border: "none", color: GOLD, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <TaskDetailDialog
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </div>
  );
};

export default Tasks;
