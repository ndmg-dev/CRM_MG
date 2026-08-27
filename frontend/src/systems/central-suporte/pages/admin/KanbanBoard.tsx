import { useState, useMemo, useEffect } from "react";
import { Badge } from "@suporte/components/ui/badge";
import { ScrollArea } from "@suporte/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { KanbanFilters, KanbanFilterValues } from "@suporte/components/admin/KanbanFilters";
import { TicketDetailDialog } from "@suporte/components/admin/TicketDetailDialog";
import { KanbanTicketCard } from "@suporte/components/admin/KanbanTicketCard";
import { KanbanTaskCard } from "@suporte/components/admin/KanbanTaskCard";
import { useSlaStatus, SlaInfo } from "@suporte/hooks/useSlaStatus";
import { ViewerCarousel } from "@suporte/components/admin/ViewerCarousel";
import { ViewerAudioUnlock } from "@suporte/components/admin/ViewerAudioUnlock";
import { TaskDetailDialog } from "@suporte/components/admin/TaskDetailDialog";
import { useUserSector } from "@suporte/hooks/useUserSector";
import { useUnreadComments } from "@suporte/hooks/useUnreadComments";


type ColumnId = "tasks" | "open" | "pending" | "parado" | "testing" | "resolved";


const columnConfig: { id: ColumnId; label: string; color: string; borderColor: string; badgeClass: string }[] = [
  { id: "tasks", label: "Tarefas", color: "bg-purple-500/10 border-purple-500/20", borderColor: "border-l-purple-500", badgeClass: "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" },
  { id: "open", label: "A Fazer", color: "bg-blue-500/10 border-blue-500/20", borderColor: "border-l-blue-500", badgeClass: "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" },
  { id: "pending", label: "Em Andamento", color: "bg-yellow-500/10 border-yellow-500/20", borderColor: "border-l-yellow-500", badgeClass: "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30" },
  { id: "parado", label: "Parados", color: "bg-slate-500/10 border-slate-500/20", borderColor: "border-l-slate-500", badgeClass: "bg-slate-500/20 text-slate-400 hover:bg-slate-500/30" },
  { id: "testing", label: "Em Teste", color: "bg-orange-500/10 border-orange-500/20", borderColor: "border-l-orange-500", badgeClass: "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30" },
  { id: "resolved", label: "Concluído", color: "bg-green-500/10 border-green-500/20", borderColor: "border-l-green-500", badgeClass: "bg-green-500/20 text-green-400 hover:bg-green-500/30" },
];

const KanbanBoard = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<KanbanFilterValues>({ priority: "", categoryId: "", assigneeId: "", sectorId: "" });
  const [defaultSectorApplied, setDefaultSectorApplied] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<Record<string, string[]>>({});

  const sector = useUserSector();
  const unreadComments = useUnreadComments();

  const isViewer = sector.isViewer && !sector.roles.some(r => ["support_agent", "dev", "admin_ti"].includes(r));
  const isCoordinator = sector.isCoordinator;
  const isCoordinatorTI = sector.roles.includes("coordinator");
  const isAdminTI = sector.isAdmin;

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["kanban-tickets", sector.userId, sector.sectorId, sector.isCoordinator, sector.isDirection, isCoordinatorTI, isAdminTI],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select(`
          *,
          assignee:profiles!assignee_id(full_name),
          requester:profiles!requester_id(full_name),
          opened_by:profiles!opened_by_id(full_name)
        `)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (sector.isDirection || isCoordinatorTI || isAdminTI) {
        // Direction, Coordinator TI, and Admin TI: see all tickets (RLS handles access)
      } else if ((sector.isCoordinator || sector.isViewer) && sector.sectorId) {
        // Other Coordinators/Viewer: see tickets in their sector only
        query = query.eq("target_sector_id", sector.sectorId);
      } else {
        // support_agent, dev, etc. sem setor de coordenação: veem só o que
        // já está atribuído a eles, MAIS o que ainda não tem responsável —
        // proposital, pra qualquer um do time poder "pegar" um chamado
        // órfão de qualquer setor em vez de ele ficar invisível até alguém
        // com visão ampla (coordenador/direção) perceber e atribuir.
        query = query.or(`assignee_id.eq.${sector.userId},assignee_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!sector.userId && sector.roles.length > 0,
  });

  // Fetch task instances
  const { data: taskInstances } = useQuery({
    queryKey: ["kanban-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_instances")
        .select("*, assignee:profiles!assignee_id(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(t => ({ ...t, _isTask: true }));
    },
  });

  // Fetch sectors for coordinator TI default
  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!(isCoordinatorTI || isAdminTI),
  });

  // Default sector filter to TI for coordinator TI
  useEffect(() => {
    if ((isCoordinatorTI || isAdminTI) && !defaultSectorApplied && sectors?.length) {
      const tiSector = sectors.find(s => s.name === "TI");
      if (tiSector) {
        setFilters(prev => ({ ...prev, sectorId: tiSector.id }));
        setDefaultSectorApplied(true);
      }
    }
  }, [isCoordinatorTI, isAdminTI, sectors, defaultSectorApplied]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("kanban-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
          if (payload.eventType === "INSERT") {
            toast.info("Novo ticket criado!", { duration: 3000 });
            // Reset viewer carousel to overview on new ticket
            if ((window as any).__viewerCarouselReset) {
              (window as any).__viewerCarouselReset();
            }
          } else if (payload.eventType === "UPDATE") {
            toast.info("Ticket atualizado", { duration: 2000 });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_instances" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const isTasksFilter = filters.categoryId === "__tasks__";

  const filteredTickets = useMemo(() => {
    if (!tickets || isTasksFilter) return [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return tickets.filter((t) => {
      const isActive = !["resolved", "closed", "canceled"].includes(t.status || "");
      // Completed tickets: only show if completed today
      if (!isActive) {
        const updatedAt = new Date(t.updated_at!);
        if (updatedAt < todayStart) return false;
      }
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.categoryId && t.category_id !== filters.categoryId) return false;
      if (filters.assigneeId === "unassigned" && t.assignee_id !== null) return false;
      if (filters.assigneeId && filters.assigneeId !== "unassigned" && t.assignee_id !== filters.assigneeId) return false;
      if (filters.sectorId && t.target_sector_id !== filters.sectorId) return false;
      return true;
    });
  }, [tickets, filters, isTasksFilter]);

  const updateStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const { error } = await supabase
        .from("tickets")
        .update({ status: status as any })
        .eq("id", ticketId)
        .is("archived_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
    },
    onError: () => {
      toast.error("Erro ao mover o ticket");
      queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
    },
  });

  const priorityOrder: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };

  const sortByPriorityThenAge = (items: typeof filteredTickets) =>
    [...items].sort((a, b) => {
      const pA = priorityOrder[a.priority || "p3"] ?? 3;
      const pB = priorityOrder[b.priority || "p3"] ?? 3;
      if (pA !== pB) return pA - pB;
      return new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime();
    });

  // Merge tasks into columns - filter completed tasks from previous days
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const pendingTasks = (taskInstances || []).filter(t => t.status === "pending");
  const completedTasks = (taskInstances || []).filter(t => 
    t.status === "completed" && t.completed_at && new Date(t.completed_at) >= todayStart
  );

  const getColumns = () => ({
    tasks: isTasksFilter ? pendingTasks : pendingTasks,
    open: isTasksFilter ? [] : sortByPriorityThenAge(filteredTickets.filter(t => t.status === "new" || t.status === "open")),
    pending: isTasksFilter ? [] : sortByPriorityThenAge(filteredTickets.filter(t => t.status === "pending")),
    parado: isTasksFilter ? [] : sortByPriorityThenAge(filteredTickets.filter(t => t.status === "parado")),
    testing: isTasksFilter ? [] : sortByPriorityThenAge(filteredTickets.filter(t => t.status === "testing")),
    resolved: isTasksFilter ? completedTasks : [...sortByPriorityThenAge(filteredTickets.filter(t => t.status === "resolved" || t.status === "closed")), ...completedTasks],
  });

  const columns = getColumns();
  const slaMap = useSlaStatus(filteredTickets);

  // Apply manual order overrides to columns
  const getOrderedItems = (colId: ColumnId) => {
    const items = columns[colId];
    const order = manualOrder[colId];
    if (!order) return items;
    const itemMap = new Map(items.map(t => [t.id, t] as const));
    const ordered = order.map(id => itemMap.get(id)).filter(Boolean) as typeof items;
    // Add any new items not in the manual order
    const remaining = items.filter(t => !order.includes(t.id));
    return [...ordered, ...remaining];
  };

  const swapItems = (colId: ColumnId, index: number, direction: -1 | 1) => {
    const items = getOrderedItems(colId);
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const ids = items.map(t => t.id);
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    setManualOrder(prev => ({ ...prev, [colId]: ids }));
  };

  const onDragEnd = (result: DropResult) => {
    if (isViewer) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    const newStatus = destination.droppableId as ColumnId;
    const ticket = tickets?.find(t => t.id === draggableId);
    if (!ticket) return;

    // Reorder within same column
    if (source.droppableId === destination.droppableId) {
      const items = getOrderedItems(newStatus);
      const ids = items.map(t => t.id);
      ids.splice(source.index, 1);
      ids.splice(destination.index, 0, draggableId);
      setManualOrder(prev => ({ ...prev, [newStatus]: ids }));
      return;
    }

    if (ticket.status === newStatus) return;
    const finalStatus = newStatus === "resolved" ? "closed" : newStatus;
    updateStatus.mutate({ ticketId: draggableId, status: finalStatus });
    toast.success(`Ticket movido para "${columnConfig.find(c => c.id === newStatus)?.label}"`);
  };

  if (isLoading) return <div>Carregando Kanban...</div>;

  // Viewer TV mode: auto-scrolling carousel
  if (isViewer) {
    return (
      <>
        <ViewerAudioUnlock />
        <ViewerCarousel
          columns={columns}
          columnConfig={columnConfig}
          slaMap={slaMap}
          unreadComments={unreadComments}
          onTicketClick={(id) => setSelectedTicketId(id)}
          onTaskClick={(id) => setSelectedTaskId(id)}
          onNewTicket={() => {}}
        />
        <TaskDetailDialog
          taskId={selectedTaskId}
          open={!!selectedTaskId}
          onOpenChange={(open) => !open && setSelectedTaskId(null)}
        />
        <TicketDetailDialog
          ticketId={selectedTicketId}
          open={!!selectedTicketId}
          onOpenChange={(open) => !open && setSelectedTicketId(null)}
          readOnly={isViewer}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Painel de Chamados</h2>
          <p className="text-muted-foreground text-sm">Arraste os cards para alterar o status • Clique para detalhes</p>
        </div>
        <KanbanFilters filters={filters} onChange={setFilters} isCoordinator={isCoordinator} isCoordinatorTI={isCoordinatorTI} isDirection={sector.isDirection} isAdmin={isAdminTI} />
      </div>

      {/* Antes esta div usava h-[calc(100vh-10rem)]: um "chute" de quanto
          espaço de chrome (Header do CRM + Topbar da Central + paddings +
          este título) já estava ocupado acima. Na prática esse total passa
          de 10rem, então a página inteira ganhava scroll vertical por cima
          do board com altura fixa — visualmente parecia "cortado" embaixo
          e na lateral. Sem altura fixa aqui, quem rola verticalmente volta
          a ser só o <main> do Layout (como o resto do CRM); cada coluna
          rola por conta própria via max-h no ScrollArea abaixo. */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-[1200px]">
            {columnConfig.map((col) => {
              const items = getOrderedItems(col.id);
              return (
                <div key={col.id} className="flex-1 min-w-[300px] flex flex-col gap-4">
                  <div className={`flex items-center justify-between p-2 rounded-lg border ${col.color}`}>
                    <span className="font-semibold">{col.label}</span>
                    <Badge className={col.badgeClass || undefined} variant={col.badgeClass ? undefined : "secondary"}>
                      {items.length}
                    </Badge>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <ScrollArea className="max-h-[65vh]">
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`space-y-3 p-1 min-h-[200px] rounded-lg transition-colors ${snapshot.isDraggingOver ? "bg-accent/20" : ""}`}
                        >
                          {items.map((item: any, index: number) => (
                            <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!!item._isTask}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                >
                                  {item._isTask ? (
                                    <KanbanTaskCard
                                      task={item}
                                      columnId={col.id}
                                      isDragging={snapshot.isDragging}
                                      onClick={() => !snapshot.isDragging && setSelectedTaskId(item.id)}
                                    />
                                  ) : (
                                    <KanbanTicketCard
                                      ticket={item}
                                      columnId={col.id}
                                      borderColor={col.borderColor}
                                      isDragging={snapshot.isDragging}
                                      slaInfo={slaMap[item.id]}
                                      unreadComments={unreadComments[item.id]}
                                      onClick={() => !snapshot.isDragging && setSelectedTicketId(item.id)}
                                      canMoveUp={index > 0}
                                      canMoveDown={index < items.length - 1}
                                      onMoveUp={() => swapItems(col.id, index, -1)}
                                      onMoveDown={() => swapItems(col.id, index, 1)}
                                    />
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </ScrollArea>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>

      <TicketDetailDialog
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
        readOnly={isViewer}
      />
      <TaskDetailDialog
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </div>
  );
};

export default KanbanBoard;

