import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@suporte/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@suporte/components/ui/alert-dialog";
import { Badge } from "@suporte/components/ui/badge";
import { Button } from "@suporte/components/ui/button";
import { Textarea } from "@suporte/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@suporte/components/ui/select";
import { Separator } from "@suporte/components/ui/separator";
import { ScrollArea } from "@suporte/components/ui/scroll-area";
import { Switch } from "@suporte/components/ui/switch";
import { Label } from "@suporte/components/ui/label";
import { Clock, User, MessageSquare, Send, Tag, Trash2, Paperclip, Download, FileText, Image, Upload, CalendarIcon, RotateCcw, Pencil, X as XIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@suporte/components/ui/popover";
import { Calendar } from "@suporte/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@suporte/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { toast } from "sonner";
import { markCommentNotificationsRead } from "@suporte/hooks/useUnreadComments";
import { ticketCategory, isTicketClosed } from "@suporte/utils/ticketStatus";

interface TicketDetailDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  archivedMode?: boolean;
}

const priorityLabels: Record<string, string> = {
  p0: "Crítica",
  p1: "Alta",
  p2: "Média",
  p3: "Baixa",
};

const statusBadgeClass: Record<string, string> = {
  new: "border-blue-400/50 bg-blue-400/10 text-blue-300",
  open: "border-blue-400/50 bg-blue-400/10 text-blue-300",
  pending: "border-yellow-400/50 bg-yellow-400/10 text-yellow-300",
  parado: "border-slate-400/50 bg-slate-400/10 text-slate-300",
  testing: "border-orange-400/50 bg-orange-400/10 text-orange-300",
  resolved: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300",
  closed: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300",
  canceled: "border-red-400/50 bg-red-400/10 text-red-300",
};

const statusLabels: Record<string, string> = {
  new: "A Fazer",
  open: "A Fazer",
  pending: "Em Andamento",
  parado: "Parado",
  testing: "Em Teste",
  resolved: "Concluído",
  closed: "Concluído",
  canceled: "Cancelado",
};

const statusDropdownOptions = [
  { value: "open", label: "A Fazer" },
  { value: "pending", label: "Em Andamento" },
  { value: "parado", label: "Parado" },
  { value: "testing", label: "Em Teste" },
  { value: "closed", label: "Concluído" },
];

export function TicketDetailDialog({ ticketId, open, onOpenChange, readOnly = false, archivedMode = false }: TicketDetailDialogProps) {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreReason, setRestoreReason] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingSectorId, setPendingSectorId] = useState<string | null>(null);
  const [sectorAssigneeId, setSectorAssigneeId] = useState<string>("unassigned");
  const [isEditingRequester, setIsEditingRequester] = useState(false);

  // Sem isso, trocar de chamado com o Select do solicitante ainda aberto
  // deixa a edição "vazando" pro próximo ticket exibido.
  useEffect(() => {
    setIsEditingRequester(false);
  }, [ticketId]);

  // Abriu o chamado: some com a bolinha de comentário não lido no card.
  useEffect(() => {
    if (open && ticketId) {
      markCommentNotificationsRead(ticketId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread-comment-counts"] });
      });
    }
  }, [open, ticketId, queryClient]);

  const { data: canDelete } = useQuery({
    queryKey: ["can-delete-ticket"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin_ti", "direction", "coordinator", "coordinator_sp", "coordinator_sc", "coordinator_sf", "coordinator_fn", "coordinator_rh"]);
      return (data?.length ?? 0) > 0;
    },
  });

  const { data: canRestore } = useQuery({
    queryKey: ["can-restore-ticket"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin_ti", "direction"]);
      return (data?.length ?? 0) > 0;
    },
  });

  // Trocar o solicitante é sensível (afeta quem a TI enxerga como "dono" do
  // problema) — só Admin TI mexe aqui, diferente das outras trocas (status,
  // prioridade, setor) que qualquer membro da TI pode fazer.
  const { data: canEditRequester } = useQuery({
    queryKey: ["can-edit-requester"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin_ti");
      return (data?.length ?? 0) > 0;
    },
    enabled: open && !readOnly,
  });

  const { data: ticket } = useQuery({
    queryKey: ["ticket-detail", ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      let query = supabase
        .from("tickets")
        .select(`
          *,
          assignee:profiles!assignee_id(id, full_name, email),
          requester:profiles!requester_id(full_name, email),
          category:categories!category_id(name),
          subcategory:subcategories!subcategory_id(name)
        `)
        .eq("id", ticketId);
      query = archivedMode
        ? query.not("archived_at", "is", null)
        : query.is("archived_at", null);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!ticketId && open,
  });

  const { data: comments } = useQuery({
    queryKey: ["ticket-comments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("comments")
        .select(`*, author:profiles!author_id(full_name)`)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!ticketId && open,
  });

  const { data: attachments } = useQuery({
    queryKey: ["ticket-attachments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      // Generate signed URLs
      const withUrls = await Promise.all(
        (data || []).map(async (att) => {
          const { data: urlData } = await supabase.storage
            .from("ticket-attachments")
            .createSignedUrl(att.file_path, 3600);
          return { ...att, signedUrl: urlData?.signedUrl || null };
        })
      );
      return withUrls;
    },
    enabled: !!ticketId && open,
  });

  // Realtime subscription for comments
  useEffect(() => {
    if (!ticketId || !open) return;
    const channel = supabase
      .channel(`comments-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, open, queryClient]);

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && !readOnly,
  });

  const { data: allProfiles } = useQuery({
    queryKey: ["all-profiles-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, sector_id")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Filter assignee options by ticket's target sector (show all if no sector)
  const staffProfiles = allProfiles?.filter((p) => {
    if (!ticket?.target_sector_id) return true;
    return p.sector_id === ticket.target_sector_id || p.id === ticket?.assignee_id;
  }) || [];

  // Profiles filtered by pending sector (for the sector change dialog)
  const pendingSectorProfiles = useMemo(() => {
    if (!pendingSectorId || !allProfiles) return [];
    return allProfiles.filter((p) => p.sector_id === pendingSectorId);
  }, [pendingSectorId, allProfiles]);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && !readOnly,
  });

  const { data: subcategories } = useQuery({
    queryKey: ["subcategories", ticket?.category_id],
    queryFn: async () => {
      if (!ticket?.category_id) return [];
      const { data, error } = await supabase
        .from("subcategories")
        .select("id, name")
        .eq("category_id", ticket.category_id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && !readOnly && !!ticket?.category_id,
  });

  const updateTicket = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (!ticketId) return;

      // Use RPC for assignee changes to bypass RLS SELECT constraints
      if ("assignee_id" in updates && Object.keys(updates).length === 1) {
        const { error } = await supabase.rpc("transfer_ticket", {
          _ticket_id: ticketId,
          _new_assignee_id: updates.assignee_id,
        });
        if (error) throw error;
        return updates;
      }

      const { error } = await supabase
        .from("tickets")
        .update(updates as any)
        .eq("id", ticketId)
        .is("archived_at", null);
      if (error) throw error;
      return updates;
    },
    onSuccess: (updates) => {
      queryClient.invalidateQueries({ queryKey: ["ticket-detail", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
      toast.success("Ticket atualizado");
      // If assignee changed to someone else, the ticket may no longer be visible — close dialog
      if (updates && "assignee_id" in updates) {
        onOpenChange(false);
      }
    },
    onError: () => toast.error("Erro ao atualizar ticket"),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!ticketId || (!commentText.trim() && !commentFile)) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Insert comment
      const { data: commentData, error } = await supabase.from("comments").insert({
        ticket_id: ticketId,
        content: commentText.trim() || (commentFile ? `📎 ${commentFile.name}` : ""),
        author_id: user.id,
        internal_only: isInternal,
      }).select("id").single();
      if (error) throw error;

      // Upload attachment if present
      if (commentFile && commentData) {
        const filePath = `${ticketId}/${crypto.randomUUID()}_${commentFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("ticket-attachments")
          .upload(filePath, commentFile);
        if (uploadError) throw uploadError;

        const { error: attError } = await supabase.from("attachments").insert({
          ticket_id: ticketId,
          comment_id: commentData.id,
          file_name: commentFile.name,
          file_path: filePath,
          file_type: commentFile.type,
          file_size: commentFile.size,
          uploaded_by: user.id,
        });
        if (attError) throw attError;
      }

      // Mesma regra do chat flutuante rápido (ConversationView.tsx): resposta
      // da TI move o chamado pra "Em Andamento" sozinha, exceto se já estiver
      // encerrado — sem isso só quem responde pelo widget rápido dispara a
      // mudança, e quem responde por aqui (o modal principal) deixa o
      // chamado preso em "A Fazer" mesmo depois de alguém já estar cuidando.
      if (!isInternal && ticket && !isTicketClosed(ticket.status) && ticketCategory(ticket.status) !== "in_progress") {
        await supabase.from("tickets").update({ status: "pending" }).eq("id", ticketId);
      }
    },
    onSuccess: () => {
      setCommentText("");
      setIsInternal(false);
      setCommentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticket-attachments", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticket-detail", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
      toast.success("Comentário adicionado");
    },
    onError: () => toast.error("Erro ao adicionar comentário"),
  });

  const archiveTicket = useMutation({
    mutationFn: async () => {
      if (!ticketId) return;
      const reason = archiveReason.trim();
      if (!reason) throw new Error("Informe o motivo do arquivamento.");
      const { error } = await supabase.rpc("archive_ticket", {
        _ticket_id: ticketId,
        _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["recent-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["active-tickets-count"] });
      queryClient.invalidateQueries({ queryKey: ["consultation-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["report-tickets"] });
      setArchiveReason("");
      setShowDeleteConfirm(false);
      toast.success("Chamado arquivado sem apagar o histórico");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao arquivar chamado"),
  });

  const restoreTicket = useMutation({
    mutationFn: async () => {
      if (!ticketId) return;
      const reason = restoreReason.trim();
      if (!reason) throw new Error("Informe o motivo da restauração.");
      const { error } = await supabase.rpc("restore_ticket", {
        _ticket_id: ticketId,
        _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultation-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      setRestoreReason("");
      setShowRestoreConfirm(false);
      toast.success("Chamado restaurado com todo o histórico");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao restaurar chamado"),
  });

  if (!ticket) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
        {!archivedMode && canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-12 top-4 h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-sm opacity-70 hover:opacity-100"
            onClick={() => setShowDeleteConfirm(true)}
            title="Arquivar chamado"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {archivedMode && canRestore && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-12 top-4 h-6 w-6 text-primary hover:text-primary rounded-sm"
            onClick={() => setShowRestoreConfirm(true)}
            title="Restaurar chamado"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/50 text-primary font-semibold">
              {String(ticket.ticket_code).padStart(3, '0')}
            </Badge>
            <Badge variant={ticket.priority === "p0" || ticket.priority === "p1" ? "destructive" : "secondary"}>
              {priorityLabels[ticket.priority || "p3"]}
            </Badge>
            <Badge
              variant="outline"
              className={cn(statusBadgeClass[ticket.status || "new"], "animate-pulse")}
            >
              {statusLabels[ticket.status || "new"]}
            </Badge>
          </div>
          <DialogTitle className="text-lg mt-2">{ticket.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
            {/* Description */}
            {ticket.description && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">{ticket.description}</div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 shrink-0" />
                {isEditingRequester ? (
                  <div className="flex flex-1 items-center gap-1">
                    <Select
                      value={ticket.requester_id || undefined}
                      onValueChange={(v) => {
                        updateTicket.mutate({ requester_id: v });
                        setIsEditingRequester(false);
                      }}
                    >
                      <SelectTrigger className="h-8 flex-1 border-2 border-primary text-sm">
                        <SelectValue placeholder="Selecionar solicitante" />
                      </SelectTrigger>
                      <SelectContent>
                        {allProfiles?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                      onClick={() => setIsEditingRequester(false)}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <span>
                    Solicitante: <strong className="text-foreground">{ticket.requester?.full_name || "—"}</strong>
                    {canEditRequester && (
                      <Button
                        type="button" variant="ghost" size="icon" className="ml-1 h-6 w-6 align-middle"
                        title="Trocar solicitante (Admin TI)"
                        onClick={() => setIsEditingRequester(true)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Criado: <strong className="text-foreground">{new Date(ticket.created_at!).toLocaleString("pt-BR")}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Tag className="h-4 w-4" />
                <span>Categoria: <strong className="text-foreground">{ticket.category?.name || "—"}{ticket.subcategory?.name ? ` / ${ticket.subcategory.name}` : ""}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xs">Tipo: <strong className="text-foreground">{ticket.type === "incident" ? "Incidente" : "Requisição"}</strong></span>
              </div>
            </div>

            <Separator />

            {/* Actions - only for staff */}
            {!readOnly && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                  <Select
                    value={
                      ticket.status === "new" || ticket.status === "open" ? "open"
                      : ticket.status === "resolved" || ticket.status === "closed" ? "closed"
                      : ticket.status || "open"
                    }
                    onValueChange={(v) => updateTicket.mutate({ status: v })}
                  >
                    <SelectTrigger className="h-9 border-2 border-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusDropdownOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Prioridade</Label>
                  <Select
                    value={ticket.priority || "p3"}
                    onValueChange={(v) => updateTicket.mutate({ priority: v })}
                  >
                    <SelectTrigger className="h-9 border-2 border-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Setor</Label>
                  <Select
                    value={ticket.target_sector_id || "none"}
                    onValueChange={(v) => {
                      const newSectorId = v === "none" ? null : v;
                      if (newSectorId !== ticket.target_sector_id) {
                        if (!newSectorId) {
                          updateTicket.mutate({ target_sector_id: null });
                        } else {
                          setPendingSectorId(newSectorId);
                          setSectorAssigneeId("unassigned");
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 border-2 border-primary">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {sectors?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Responsável</Label>
                  <Select
                    value={ticket.assignee_id || "unassigned"}
                    onValueChange={(v) => updateTicket.mutate({ assignee_id: v === "unassigned" ? null : v })}
                  >
                    <SelectTrigger className="h-9 border-2 border-primary">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Nenhum</SelectItem>
                      {staffProfiles?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Data Limite</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("h-9 w-full justify-start text-left font-normal border-2 border-primary", !ticket.due_date && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {ticket.due_date ? format(new Date(ticket.due_date), "dd/MM/yyyy") : "Definir prazo"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={ticket.due_date ? new Date(ticket.due_date) : undefined}
                        onSelect={(date) => updateTicket.mutate({ due_date: date ? date.toISOString() : null })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Read-only info for users */}
            {readOnly && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                  <Badge variant="outline" className={statusBadgeClass[ticket.status || "new"]}>{statusLabels[ticket.status || "new"]}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Prioridade</Label>
                  <Badge variant={ticket.priority === "p0" || ticket.priority === "p1" ? "destructive" : "secondary"}>
                    {priorityLabels[ticket.priority || "p3"]}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Responsável</Label>
                  <span className="text-foreground">{ticket.assignee?.full_name || "Não atribuído"}</span>
                </div>
              </div>
            )}

            {/* Attachments */}
            {attachments && attachments.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <Paperclip className="h-4 w-4" /> Anexos ({attachments.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att) => {
                    const isImage = att.file_type?.startsWith("image/");
                    return (
                      <div key={att.id} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2 text-sm">
                        {isImage ? <Image className="h-4 w-4 text-blue-400 shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="truncate flex-1" title={att.file_name}>{att.file_name}</span>
                        {att.signedUrl && (
                          <a href={att.signedUrl} target="_blank" rel="noopener noreferrer" title="Baixar anexo">
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Image previews */}
                {attachments.filter(a => a.file_type?.startsWith("image/") && a.signedUrl).map((att) => (
                  <a key={att.id} href={att.signedUrl!} target="_blank" rel="noopener noreferrer" className="block mt-2">
                    <img
                      src={att.signedUrl!}
                      alt={att.file_name}
                      className="rounded-lg border max-h-48 object-contain w-full"
                    />
                  </a>
                ))}
              </div>
            )}

            <Separator />

            {/* Comments */}
            <div>
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4" /> Comentários ({comments?.length || 0})
              </h4>
              <div className="space-y-3">
                {comments?.map((c) => {
                  const commentAtts = attachments?.filter(a => a.comment_id === c.id) || [];
                  return (
                    <div key={c.id} className={`rounded-lg p-3 text-sm ${c.internal_only ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-muted/50"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs">
                          {c.author?.full_name || "Desconhecido"}
                          {c.internal_only && <Badge variant="outline" className="ml-2 text-[10px] text-yellow-500">Interno</Badge>}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.created_at!).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{c.content}</p>
                      {commentAtts.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {commentAtts.map((att) => {
                            const isImg = att.file_type?.startsWith("image/");
                            return (
                              <div key={att.id}>
                                <div className="flex items-center gap-2 text-xs">
                                  {isImg ? <Image className="h-3 w-3 text-blue-400" /> : <FileText className="h-3 w-3 text-muted-foreground" />}
                                  <span className="truncate">{att.file_name}</span>
                                  {att.signedUrl && (
                                    <a href={att.signedUrl} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-3 w-3 text-primary hover:text-primary/80" />
                                    </a>
                                  )}
                                </div>
                                {isImg && att.signedUrl && (
                                  <a href={att.signedUrl} target="_blank" rel="noopener noreferrer">
                                    <img src={att.signedUrl} alt={att.file_name} className="rounded border max-h-32 object-contain mt-1" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {(!comments || comments.length === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda</p>
                )}
              </div>

              {/* New comment */}
              <div className="mt-4 space-y-2">
                <Textarea
                  placeholder="Escreva um comentário... (Enter para enviar, Shift+Enter para nova linha)"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if ((commentText.trim() || commentFile) && !addComment.isPending) {
                        addComment.mutate();
                      }
                    }
                  }}
                  rows={2}
                  className="border-2 border-primary focus-visible:ring-primary/40"
                />
                {commentFile && (
                  <div className="flex items-center gap-2 text-xs bg-muted/50 rounded p-2">
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate flex-1">{commentFile.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setCommentFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error("Arquivo deve ter no máximo 10MB");
                        return;
                      }
                      setCommentFile(file);
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!readOnly && (
                      <>
                        <Switch
                          id="internal"
                          checked={isInternal}
                          onCheckedChange={setIsInternal}
                          className="border-2 border-muted-foreground/40 data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-muted"
                        />
                        <Label
                          htmlFor="internal"
                          className={cn(
                            "text-xs",
                            isInternal ? "text-amber-400 font-semibold" : "text-muted-foreground"
                          )}
                        >
                          Nota interna
                        </Label>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()} title="Anexar arquivo">
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addComment.mutate()}
                    disabled={(!commentText.trim() && !commentFile) || addComment.isPending}
                  >
                    <Send className="h-3 w-3 mr-1" /> Enviar
                  </Button>
                </div>
              </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar chamado</AlertDialogTitle>
          <AlertDialogDescription>
            O chamado {String(ticket.ticket_code).padStart(3, '0')} — “{ticket.title}” deixará de aparecer nas filas, mas todo o histórico e os anexos serão preservados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-3">
          <Label htmlFor="archive-reason" className="text-xs text-muted-foreground mb-1 block">Motivo obrigatório</Label>
          <Textarea
            id="archive-reason"
            value={archiveReason}
            onChange={(event) => setArchiveReason(event.target.value)}
            placeholder="Ex.: chamado aberto em duplicidade"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setArchiveReason("")}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!archiveReason.trim() || archiveTicket.isPending}
            onClick={() => archiveTicket.mutate()}
          >
            {archiveTicket.isPending ? "Arquivando..." : "Arquivar sem apagar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restaurar chamado</AlertDialogTitle>
          <AlertDialogDescription>
            O chamado voltará às filas ativas com comentários e anexos preservados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-3">
          <Label htmlFor="restore-reason" className="text-xs text-muted-foreground mb-1 block">Motivo obrigatório</Label>
          <Textarea
            id="restore-reason"
            value={restoreReason}
            onChange={(event) => setRestoreReason(event.target.value)}
            placeholder="Ex.: arquivamento realizado por engano"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setRestoreReason("")}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!restoreReason.trim() || restoreTicket.isPending}
            onClick={() => restoreTicket.mutate()}
          >
            {restoreTicket.isPending ? "Restaurando..." : "Restaurar chamado"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={pendingSectorId !== null} onOpenChange={(open) => { if (!open) setPendingSectorId(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Alterar Setor</AlertDialogTitle>
          <AlertDialogDescription>
            Selecione um responsável do novo setor para confirmar a transferência.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-3">
          <Label className="text-xs text-muted-foreground mb-1 block">Responsável</Label>
          <Select value={sectorAssigneeId} onValueChange={setSectorAssigneeId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione um responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Nenhum</SelectItem>
              {pendingSectorProfiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pendingSectorProfiles.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">Nenhum usuário encontrado neste setor.</p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingSectorId(null)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={sectorAssigneeId === "unassigned"}
            onClick={() => {
              if (pendingSectorId && sectorAssigneeId !== "unassigned") {
                updateTicket.mutate({ target_sector_id: pendingSectorId, assignee_id: sectorAssigneeId });
                setPendingSectorId(null);
              }
            }}
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

