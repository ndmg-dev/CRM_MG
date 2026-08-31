import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@suporte/components/ui/textarea";
import {
  Select as ShadSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@suporte/components/ui/select";
import { Select, Badge, Tabs, Avatar } from "@mg/ui";
import { Label } from "@suporte/components/ui/label";
import { Clock, Tag, Trash2, Paperclip, Download, FileText, Image, CalendarIcon, RotateCcw, Pencil, X as XIcon, Send, Users, Check, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@suporte/components/ui/popover";
import { Calendar } from "@suporte/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@suporte/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { toast } from "sonner";
import { markCommentNotificationsRead } from "@suporte/hooks/useUnreadComments";
import { ticketCategory, isTicketClosed } from "@suporte/utils/ticketStatus";
import { reopenTicketWithReason } from "@suporte/utils/reopenTicket";
import { ReopenReasonDialog } from "@suporte/components/admin/ReopenReasonDialog";
import { isSystemNote } from "@suporte/utils/systemNote";
import { useUserSector } from "@suporte/hooks/useUserSector";

interface TicketDetailDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  archivedMode?: boolean;
}

// Tokens — ver frontend/packages/@mg/tokens/build/tokens.css. Handoff:
// Modal Chamado.dc.html.
const GOLD = "var(--mg-color-gold-base)";
const TEXT_PRIMARY = "var(--mg-color-text-primary)";
const TEXT_SECONDARY = "var(--mg-color-text-secondary)";
const TEXT_MUTED = "var(--mg-color-text-muted)";
const BORDER_DEFAULT = "var(--mg-color-border-default)";
const BG_CARD = "var(--mg-color-bg-card)";
const BG_SURFACE = "var(--mg-color-bg-surface)";
const ERROR = "var(--mg-color-status-error)";
// Cor legível pra descrição/corpo de texto — mais clara que text-secondary,
// pro texto do chamado não ficar apagado demais dentro da caixa escura.
const BODY_TEXT = "rgba(245,245,245,0.82)";

const priorityLabels: Record<string, string> = { p0: "Crítica", p1: "Alta", p2: "Média", p3: "Baixa" };
const priorityVariant: Record<string, "err" | "warn" | "ok"> = { p0: "err", p1: "err", p2: "warn", p3: "ok" };

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginBottom: 6 }}>{children}</div>;
}

function StaticField({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: 36, display: "flex", alignItems: "center", gap: 6, padding: "0 10px",
        background: BG_CARD, border: `0.5px solid ${BORDER_DEFAULT}`, borderRadius: 8,
        fontSize: 13, color: TEXT_PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function TicketDetailDialog({ ticketId, open, onOpenChange, readOnly = false, archivedMode = false }: TicketDetailDialogProps) {
  const queryClient = useQueryClient();
  // Nota interna só é visível pra Admin TI e pra quem criou a nota — mesmo
  // outro membro da TI (support_agent, dev, coordenador) não deve ver a
  // nota interna de um colega. Ver `visibleComments` abaixo.
  const { isAdmin } = useUserSector();
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreReason, setRestoreReason] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Compartilhado entre o input de arquivo (clicar em "Anexar") e o
  // onPaste do textarea (colar print) — mesma validação nos dois casos.
  // Aceita mais de um arquivo de uma vez (seleção múltipla ou vários itens
  // colados juntos), acumulando em cima do que já tinha sido escolhido.
  const pickFiles = (files: File[]) => {
    const valid = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" tem mais de 10MB e não foi anexado`);
        return false;
      }
      return true;
    });
    if (valid.length > 0) setCommentFiles((prev) => [...prev, ...valid]);
  };
  const [activeTab, setActiveTab] = useState("details");
  // Preview de imagem em modal em vez de abrir em nova aba — nova aba tira o
  // agente do chamado só pra ver um print anexado. É um <Dialog> do Radix
  // aninhado dentro do modal do chamado (não um <div fixed> na mão) —
  // versões anteriores disso brigavam com o Radix (Esc/clique fechavam os
  // dois juntos, ou o botão de fechar simplesmente não respondia por causa
  // do FocusScope do Dialog de fora tentando reclamar o foco no meio do
  // clique). Dialog aninhado é o padrão que o Radix já sabe resolver:
  // cada camada só reage ao que é dela.
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null);
  const [pendingSectorId, setPendingSectorId] = useState<string | null>(null);
  const [sectorAssigneeId, setSectorAssigneeId] = useState<string>("unassigned");
  const [isEditingRequester, setIsEditingRequester] = useState(false);
  // Status pra onde o Select estava indo quando detectamos que é uma
  // reabertura (chamado já concluído/cancelado voltando a ficar ativo) —
  // segura a troca até o motivo ser preenchido no ReopenReasonDialog.
  const [pendingReopenStatus, setPendingReopenStatus] = useState<string | null>(null);

  // Sem isso, trocar de chamado com o Select do solicitante ainda aberto
  // deixa a edição "vazando" pro próximo ticket exibido.
  useEffect(() => {
    setIsEditingRequester(false);
    setActiveTab("details");
  }, [ticketId]);

  // Abriu o chamado: some com a bolinha de comentário não lido no card.
  useEffect(() => {
    if (open && ticketId) {
      markCommentNotificationsRead(ticketId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread-comment-counts"] });
      });
    }
  }, [open, ticketId, queryClient]);

  const { data: currentUserId } = useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
  });

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
          assignee:profiles!assignee_id(id, full_name, email, foto_url),
          requester:profiles!requester_id(full_name, email),
          opened_by:profiles!opened_by_id(full_name),
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

  // Limita a leitura a um número generoso, mas finito, de linhas — sem isso,
  // um chamado antigo com centenas de idas e vindas recarrega e re-renderiza
  // tudo a cada evento realtime, mesmo pra ver uma mensagem nova. Busca as
  // mais recentes (desc) e inverte pra manter a ordem cronológica de leitura.
  const RECENT_ROWS_LIMIT = 200;

  const { data: comments } = useQuery({
    queryKey: ["ticket-comments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("comments")
        .select(`*, author:profiles!author_id(full_name, foto_url)`)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
        .limit(RECENT_ROWS_LIMIT);
      if (error) throw error;
      return (data || []).slice().reverse();
    },
    enabled: !!ticketId && open,
  });

  // Nota interna: só Admin TI e quem escreveu enxergam. Qualquer outro
  // membro da TI (support_agent, dev, coordenador) nem sabe que ela existe
  // — some da lista inteiramente, não só do conteúdo.
  const visibleComments = useMemo(
    () => comments?.filter((c) => !c.internal_only || isAdmin || c.author_id === currentUserId),
    [comments, isAdmin, currentUserId]
  );

  // Marca como lido pra virar "✓✓ Lido às" na bolha de quem enviou — mesma
  // lógica do chat flutuante (ConversationView.tsx), que o modal não tinha:
  // aqui a mensagem enviada de um lado nunca mostrava se a outra pessoa já
  // tinha visto. RPC em vez de UPDATE direto pelo mesmo motivo de lá: a RLS
  // de comments só deixa o autor mexer na própria linha, e quem marca como
  // lido é sempre quem recebeu.
  useEffect(() => {
    if (!ticketId || !open || !currentUserId || !comments) return;
    const unreadFromOthers = comments.filter((c) => c.author_id !== currentUserId && !c.internal_only && !c.read_at);
    if (unreadFromOthers.length === 0) return;
    supabase.rpc("mark_comments_read", { p_comment_ids: unreadFromOthers.map((c) => c.id) })
      .then(({ error }) => {
        if (error) console.error("[ticket-detail] Falha ao marcar comentários como lidos:", error);
        queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
      });
  }, [ticketId, open, currentUserId, comments, queryClient]);

  const { data: attachments } = useQuery({
    queryKey: ["ticket-attachments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
        .limit(RECENT_ROWS_LIMIT);
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
      return withUrls.reverse();
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
    // readOnly (usuário comum vendo o próprio chamado) nunca mostra os
    // selects de responsável/setor/solicitante que usam essa lista.
    enabled: open && !readOnly,
  });

  // IDs de quem tem qualquer role de staff — usado só pra tirar essas
  // pessoas da lista de "Trocar solicitante". O chamado é sempre de um
  // usuário comum; listar a TI ali é um convite a erro (setar o solicitante
  // como um agente por engano).
  const { data: staffUserIds } = useQuery({
    queryKey: ["staff-user-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id");
      if (error) throw error;
      return new Set((data || []).map((r) => r.user_id));
    },
    enabled: open && !readOnly && !!canEditRequester,
  });

  const requesterOptions = useMemo(() => {
    if (!allProfiles) return [];
    if (!staffUserIds) return allProfiles;
    return allProfiles.filter((p) => !staffUserIds.has(p.id) || p.id === ticket?.requester_id);
  }, [allProfiles, staffUserIds, ticket?.requester_id]);

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

  const reopenTicket = useMutation({
    mutationFn: async ({ targetStatus, reason }: { targetStatus: string; reason: string }) => {
      if (!ticketId) return;
      await reopenTicketWithReason(ticketId, targetStatus, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-detail", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
      setPendingReopenStatus(null);
      toast.success("Chamado reaberto");
    },
    onError: () => toast.error("Erro ao reabrir chamado"),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!ticketId || (!commentText.trim() && commentFiles.length === 0)) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const fallbackContent = commentFiles.length === 1
        ? `📎 ${commentFiles[0].name}`
        : commentFiles.length > 1
          ? `📎 ${commentFiles.length} arquivos`
          : "";

      // Insert comment
      const { data: commentData, error } = await supabase.from("comments").insert({
        ticket_id: ticketId,
        content: commentText.trim() || fallbackContent,
        author_id: user.id,
        internal_only: isInternal,
      }).select("id").single();
      if (error) throw error;

      // Upload de cada anexo, todos ligados ao mesmo comentário — um por um
      // em vez de Promise.all pra não estourar a conexão com muitos arquivos
      // grandes de uma vez e pra manter a ordem de upload previsível.
      if (commentFiles.length > 0 && commentData) {
        for (const file of commentFiles) {
          const filePath = `${ticketId}/${crypto.randomUUID()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("ticket-attachments")
            .upload(filePath, file);
          if (uploadError) throw uploadError;

          const { error: attError } = await supabase.from("attachments").insert({
            ticket_id: ticketId,
            comment_id: commentData.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
          });
          if (attError) throw attError;
        }
      }

      // Mesma regra do chat flutuante rápido (ConversationView.tsx): resposta
      // da TI move o chamado pra "Em Andamento" sozinha, exceto se já estiver
      // encerrado — sem isso só quem responde pelo widget rápido dispara a
      // mudança, e quem responde por aqui (o modal principal) deixa o
      // chamado preso em "A Fazer" mesmo depois de alguém já estar cuidando.
      // Busca o status na hora (em vez de confiar no `ticket` do closure do
      // render) — evita que uma troca de status rápida logo antes do envio
      // do comentário seja ignorada por causa de um valor desatualizado.
      if (!isInternal) {
        const { data: freshTicket } = await supabase
          .from("tickets")
          .select("status")
          .eq("id", ticketId)
          .single();
        if (freshTicket && !isTicketClosed(freshTicket.status) && ticketCategory(freshTicket.status) !== "in_progress") {
          await supabase.from("tickets").update({ status: "pending" }).eq("id", ticketId).is("archived_at", null);
        }
      }
    },
    onSuccess: () => {
      setCommentText("");
      setIsInternal(false);
      setCommentFiles([]);
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

  const detailsTabContent = (
    <div>
      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 18 }}>
        <div>
          <FieldLabel>Status</FieldLabel>
          {readOnly ? (
            <StaticField>{statusLabels[ticket.status || "new"]}</StaticField>
          ) : (
            <Select
              aria-label="Status"
              value={
                ticket.status === "new" || ticket.status === "open" ? "open"
                : ticket.status === "resolved" || ticket.status === "closed" ? "closed"
                : ticket.status || "open"
              }
              options={statusDropdownOptions}
              onValueChange={(v) => {
                // Reabertura (chamado já concluído/cancelado voltando a
                // ficar ativo) exige motivo — segura a troca até o
                // ReopenReasonDialog ser preenchido em vez de aplicar
                // direto como qualquer outra mudança de status.
                if (isTicketClosed(ticket.status) && v !== "closed") {
                  setPendingReopenStatus(v);
                } else {
                  updateTicket.mutate({ status: v });
                }
              }}
            />
          )}
        </div>
        <div>
          <FieldLabel>Setor</FieldLabel>
          {readOnly ? (
            <StaticField>{sectors?.find((s) => s.id === ticket.target_sector_id)?.name || "—"}</StaticField>
          ) : (
            <Select
              aria-label="Setor"
              value={ticket.target_sector_id || "none"}
              options={[{ value: "none", label: "Nenhum" }, ...((sectors ?? []).map((s) => ({ value: s.id, label: s.name })))]}
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
            />
          )}
        </div>
        <div>
          <FieldLabel>Data Limite</FieldLabel>
          {readOnly ? (
            <StaticField>
              <CalendarIcon className="h-3 w-3" style={{ color: TEXT_SECONDARY }} />
              {ticket.due_date ? format(new Date(ticket.due_date), "dd/MM/yyyy") : "—"}
            </StaticField>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  style={{
                    height: 36, width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "0 10px",
                    background: BG_SURFACE, border: `0.5px solid ${BORDER_DEFAULT}`, borderRadius: 8,
                    fontSize: 13, color: ticket.due_date ? TEXT_PRIMARY : TEXT_MUTED, cursor: "pointer",
                  }}
                >
                  <CalendarIcon className="h-3.5 w-3.5" style={{ color: TEXT_SECONDARY }} />
                  {ticket.due_date ? format(new Date(ticket.due_date), "dd/MM/yyyy") : "Definir prazo"}
                </button>
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
          )}
        </div>
        <div>
          <FieldLabel>Responsável</FieldLabel>
          {readOnly ? (
            <StaticField>
              {ticket.assignee?.full_name ? <Avatar name={ticket.assignee.full_name} src={ticket.assignee.foto_url ?? undefined} size="sm" /> : null}
              {ticket.assignee?.full_name || "Não atribuído"}
            </StaticField>
          ) : (
            <Select
              aria-label="Responsável"
              value={ticket.assignee_id || "unassigned"}
              options={[{ value: "unassigned", label: "Nenhum" }, ...(staffProfiles?.map((p) => ({ value: p.id, label: p.full_name || p.email || "" })) ?? [])]}
              onValueChange={(v) => updateTicket.mutate({ assignee_id: v === "unassigned" ? null : v })}
            />
          )}
        </div>
      </div>
      {!readOnly && (
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0 }}>
          Editar status, setor, responsável e prazo direto pelos campos acima. Prioridade fica no cabeçalho.
        </p>
      )}
    </div>
  );

  const attachmentsTabContent = (
    <div>
      {attachments && attachments.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {attachments.map((att) => {
            const isImg = att.file_type?.startsWith("image/");
            return (
              <button
                key={att.id}
                type="button"
                onClick={() => {
                  if (isImg && att.signedUrl) setPreviewImage({ url: att.signedUrl, alt: att.file_name });
                  else if (att.signedUrl) window.open(att.signedUrl, "_blank", "noopener,noreferrer");
                }}
                style={{ background: BG_CARD, border: `0.5px solid ${BORDER_DEFAULT}`, borderRadius: 10, overflow: "hidden", textAlign: "left", cursor: "pointer" }}
              >
                {isImg && att.signedUrl ? (
                  <img src={att.signedUrl} alt={att.file_name} style={{ height: 100, width: "100%", objectFit: "cover" }} />
                ) : (
                  <div
                    style={{
                      height: 100, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "repeating-linear-gradient(135deg, var(--mg-color-bg-hover), var(--mg-color-bg-hover) 10px, var(--mg-color-bg-card) 10px, var(--mg-color-bg-card) 20px)",
                    }}
                  >
                    <FileText className="h-5 w-5" style={{ color: TEXT_MUTED }} />
                  </div>
                )}
                <div className="flex items-center justify-between" style={{ padding: "8px 10px" }}>
                  <span style={{ fontSize: 12, color: TEXT_PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.file_name}</span>
                  <Download className="h-3.5 w-3.5" style={{ color: TEXT_SECONDARY, flexShrink: 0, marginLeft: 8 }} />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "24px 0" }}>Nenhum anexo</p>
      )}
    </div>
  );

  const messagesTabContent = (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {visibleComments?.map((c, i) => {
        const commentAtts = attachments?.filter((a) => a.comment_id === c.id) || [];
        if (isSystemNote(c.content)) {
          return (
            <div key={c.id} className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: TEXT_MUTED, padding: "4px 2px" }}>
              <span>{c.author?.full_name || "Sistema"} · {c.content}</span>
              <span style={{ marginLeft: "auto" }}>{formatTime(c.created_at!)}</span>
            </div>
          );
        }
        const mine = c.author_id === currentUserId;
        const prev = visibleComments[i - 1];
        const next = visibleComments[i + 1];
        const showAuthor = !prev || prev.author_id !== c.author_id || isSystemNote(prev.content);
        // Avatar só na última mensagem do grupo (mesmo critério do chat
        // flutuante, ConversationView.tsx) — evita repetir a foto em cada
        // linha de uma sequência de mensagens seguidas da mesma pessoa.
        const isLastInGroup = !next || next.author_id !== c.author_id || isSystemNote(next.content);
        // Barra de "Nota interna" — só na primeira mensagem de uma sequência
        // interna seguida (mesmo critério de agrupamento do resto: evita uma
        // barra repetida em cada linha de várias notas internas seguidas).
        // `visibleComments` já garante que só chegou até aqui quem pode ver
        // (Admin TI ou quem escreveu) — nem outro membro comum da TI, nem o
        // solicitante (que usa outro componente, o chat flutuante).
        const showInternalBar = c.internal_only && (!prev || !prev.internal_only || isSystemNote(prev.content));
        // Mesmo padrão visual do chat flutuante (ConversationView.tsx):
        // bolha sólida (sem borda), nome fora/acima dela — não dentro —, e
        // cauda no canto de quem enviou. Antes essa bolha tinha um estilo
        // próprio (translúcida, com borda, nome dentro) que destoava do
        // resto do sistema. A foto de perfil (quando o usuário já sincronizou
        // uma) some junto com o resto do agrupamento em vez de aparecer solta.
        return (
          <div key={c.id} className="flex flex-col" style={{ gap: 4, alignItems: mine ? "flex-end" : "flex-start" }}>
            {showInternalBar && (
              <div className="flex items-center gap-2" style={{ width: "100%" }}>
                <div style={{ height: 1, flex: 1, background: "rgba(245,158,11,0.35)" }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--mg-color-status-warning)", whiteSpace: "nowrap" }}>
                  🔒 Nota interna · só a TI vê
                </span>
                <div style={{ height: 1, flex: 1, background: "rgba(245,158,11,0.35)" }} />
              </div>
            )}
            <div
              className="flex items-end"
              style={{ gap: 6, flexDirection: mine ? "row-reverse" : "row", maxWidth: "70%", alignSelf: mine ? "flex-end" : "flex-start" }}
            >
            {isLastInGroup ? (
              <Avatar name={c.author?.full_name || "?"} src={c.author?.foto_url ?? undefined} size="sm" />
            ) : (
              <div style={{ width: 24, flexShrink: 0 }} />
            )}
            <div className="flex flex-col" style={{ alignItems: mine ? "flex-end" : "flex-start", minWidth: 0 }}>
            {showAuthor && (
              <span style={{ margin: "0 4px 2px", fontSize: 10, color: TEXT_MUTED }}>
                {c.author?.full_name || "Desconhecido"}
              </span>
            )}
            {commentAtts.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={() => att.signedUrl && (att.file_type?.startsWith("image/") ? setPreviewImage({ url: att.signedUrl, alt: att.file_name }) : window.open(att.signedUrl, "_blank", "noopener,noreferrer"))}
                style={{
                  marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6,
                  background: BG_CARD, border: `0.5px solid ${BORDER_DEFAULT}`,
                  borderRadius: 8, padding: "6px 10px", fontSize: 12, color: BODY_TEXT, cursor: "pointer",
                }}
              >
                {att.file_type?.startsWith("image/") ? <Image className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                {att.file_name}
              </button>
            ))}
            {c.content && (
              <div
                style={{
                  width: "fit-content",
                  maxWidth: "100%",
                  background: mine ? GOLD : BG_CARD,
                  borderRadius: 16,
                  borderBottomRightRadius: mine ? 4 : 16,
                  borderBottomLeftRadius: mine ? 16 : 4,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: mine ? "var(--mg-color-bg-base)" : TEXT_PRIMARY,
                }}
              >
                {c.content}
              </div>
            )}
            <span className="flex items-center gap-1" style={{ margin: "2px 4px 0", fontSize: 9, color: TEXT_MUTED }}>
              {mine && (
                c.read_at
                  ? <CheckCheck className="h-2.5 w-2.5" style={{ color: GOLD }} />
                  : <Check className="h-2.5 w-2.5" />
              )}
              {mine && c.read_at ? `Lido às ${formatTime(c.read_at)}` : formatTime(c.created_at!)}
            </span>
            </div>
            </div>
          </div>
        );
      })}
      {(!visibleComments || visibleComments.length === 0) && (
        <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "24px 0" }}>Nenhuma mensagem ainda</p>
      )}
    </div>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-[720px] p-0 gap-0 overflow-hidden [&>button:last-child]:hidden"
        style={{ background: BG_SURFACE, border: `0.5px solid ${BORDER_DEFAULT}`, maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: "14px 22px", borderBottom: `0.5px solid ${BORDER_DEFAULT}`, flexShrink: 0 }}>
          <div className="flex items-center gap-2.5">
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: TEXT_MUTED, background: BG_CARD, border: `0.5px solid ${BORDER_DEFAULT}`, padding: "3px 9px", borderRadius: 6 }}>
              #{String(ticket.ticket_code).padStart(3, "0")}
            </span>
            {readOnly ? (
              <Badge variant={priorityVariant[ticket.priority || "p3"]}>{priorityLabels[ticket.priority || "p3"]}</Badge>
            ) : (
              // Native <select> estilizado como pílula — o Select do @mg/ui
              // tem largura mínima fixa (200px) e não cabe no header ao lado
              // do id; aqui só precisa ficar do tamanho da própria etiqueta.
              <select
                value={ticket.priority || "p3"}
                onChange={(e) => updateTicket.mutate({ priority: e.target.value })}
                aria-label="Prioridade"
                style={{
                  appearance: "none", WebkitAppearance: "none", cursor: "pointer",
                  fontSize: 11.5, fontWeight: 700, textTransform: "uppercase",
                  border: `0.5px solid ${priorityVariant[ticket.priority || "p3"] === "err" ? "rgba(239,68,68,0.28)" : priorityVariant[ticket.priority || "p3"] === "warn" ? "rgba(245,158,11,0.28)" : "rgba(34,197,94,0.28)"}`,
                  background: priorityVariant[ticket.priority || "p3"] === "err" ? "rgba(239,68,68,0.10)" : priorityVariant[ticket.priority || "p3"] === "warn" ? "rgba(245,158,11,0.10)" : "rgba(34,197,94,0.10)",
                  color: priorityVariant[ticket.priority || "p3"] === "err" ? ERROR : priorityVariant[ticket.priority || "p3"] === "warn" ? "var(--mg-color-status-warning)" : "var(--mg-color-status-success)",
                  borderRadius: 999, padding: "3px 22px 3px 10px",
                }}
              >
                {Object.entries(priorityLabels).map(([k, v]) => (
                  <option key={k} value={k} style={{ background: BG_CARD, color: TEXT_PRIMARY }}>{v}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!archivedMode && canDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                title="Arquivar chamado"
                className="hover:bg-red-500/10 hover:text-red-400"
                style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: TEXT_MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {archivedMode && canRestore && (
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(true)}
                title="Restaurar chamado"
                style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: GOLD, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
              style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: TEXT_SECONDARY, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Título + meta */}
        <div style={{ padding: "14px 22px 6px", flexShrink: 0 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY }}>{ticket.title}</h2>
          {ticket.description && (
            <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.5, color: BODY_TEXT }}>{ticket.description}</p>
          )}
          <div className="flex flex-wrap items-center" style={{ gap: 20, fontSize: 12, color: TEXT_SECONDARY }}>
            <span className="flex items-center gap-1.5">
              {isEditingRequester ? (
                <span className="flex items-center gap-1" style={{ display: "inline-flex" }}>
                  <ShadSelect
                    value={ticket.requester_id || undefined}
                    onValueChange={(v) => {
                      updateTicket.mutate({ requester_id: v });
                      setIsEditingRequester(false);
                    }}
                  >
                    <SelectTrigger className="h-8 border-2 border-primary text-sm" style={{ minWidth: 200 }}>
                      <SelectValue placeholder="Selecionar solicitante" />
                    </SelectTrigger>
                    <SelectContent>
                      {requesterOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </ShadSelect>
                  <button type="button" onClick={() => setIsEditingRequester(false)} style={{ color: TEXT_MUTED, background: "none", border: "none", cursor: "pointer" }}>
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : ticket.opened_by_id && ticket.opened_by_id !== ticket.requester_id ? (
                // Só diferencia "aberto por" quando alguém abriu em nome de
                // outra pessoa (ver migration ticket_opened_by) — o caso
                // comum (chamado pra si mesmo) continua com a linha única
                // de sempre, no bloco abaixo.
                <span>
                  Aberto por: <b style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{ticket.opened_by?.full_name || "—"}</b>
                  {" · "}Para: <b style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{ticket.requester?.full_name || "—"}</b>
                  {canEditRequester && (
                    <button type="button" title="Trocar solicitante (Admin TI)" onClick={() => setIsEditingRequester(true)} style={{ marginLeft: 4, color: TEXT_MUTED, background: "none", border: "none", cursor: "pointer", verticalAlign: "middle" }}>
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ) : (
                <span>
                  Solicitante: <b style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{ticket.requester?.full_name || "—"}</b>
                  {canEditRequester && (
                    <button type="button" title="Trocar solicitante (Admin TI)" onClick={() => setIsEditingRequester(true)} style={{ marginLeft: 4, color: TEXT_MUTED, background: "none", border: "none", cursor: "pointer", verticalAlign: "middle" }}>
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </span>
              )}
            </span>
            <span>Criado: <b style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{new Date(ticket.created_at!).toLocaleString("pt-BR")}</b></span>
            <span>Categoria: <b style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{ticket.category?.name || "—"}{ticket.subcategory?.name ? ` / ${ticket.subcategory.name}` : ""}</b></span>
            <span>Tipo: <b style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{ticket.type === "incident" ? "Incidente" : "Requisição"}</b></span>
          </div>
        </div>

        {/* Tabs + conteúdo com scroll próprio — overflowY é o que realmente
            faz o conteúdo rolar aqui dentro; sem ele (bug anterior), o
            texto só "vazava" pra fora e ficava cortado pelo overflow-hidden
            do DialogContent, sem jeito de rolar até o resto. */}
        <div style={{ padding: "0 22px", flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            items={[
              { value: "details", label: "Detalhes", content: detailsTabContent },
              { value: "anexos", label: `Anexos (${attachments?.length || 0})`, content: attachmentsTabContent },
              { value: "mensagens", label: `Mensagens (${visibleComments?.length || 0})`, content: messagesTabContent },
            ]}
          />
        </div>

        {/* Composer */}
        {activeTab === "mensagens" && (
          <div style={{ borderTop: `0.5px solid ${BORDER_DEFAULT}`, padding: "14px 22px", flexShrink: 0 }}>
            <Textarea
              placeholder="Escreva um comentário... (Enter para enviar, Shift+Enter para nova linha)"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if ((commentText.trim() || commentFiles.length > 0) && !addComment.isPending) {
                    addComment.mutate();
                  }
                }
              }}
              // Colar print (Ctrl+V) direto no campo de texto — mesmo
              // comportamento que o chat flutuante já tinha (ConversationView.tsx),
              // faltava aqui no modal. Antes só dava pra anexar clicando no
              // botão "Anexar", print colado direto não ia pra lugar nenhum.
              // Pega TODAS as imagens coladas de uma vez (Windows deixa
              // copiar/colar vários prints juntos), não só a primeira.
              onPaste={(e) => {
                const items = Array.from(e.clipboardData.items).filter((i) => i.type.startsWith("image/"));
                if (items.length === 0) return;
                const files = items.map((i) => i.getAsFile()).filter((f): f is File => !!f);
                if (files.length === 0) return;
                e.preventDefault();
                pickFiles(files);
              }}
              rows={2}
              style={{ background: BG_CARD, borderColor: BORDER_DEFAULT, color: TEXT_PRIMARY }}
            />
            {commentFiles.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>
                  {commentFiles.length} {commentFiles.length === 1 ? "arquivo anexado" : "arquivos anexados"}
                </div>
                {/* Altura travada + scroll próprio — sem isso, anexar muitos
                    arquivos de uma vez (a seleção múltipla permite qualquer
                    quantidade) empurrava o composer inteiro pra baixo do
                    modal, escondendo o botão Enviar. */}
                <div className="flex flex-col" style={{ gap: 4, maxHeight: 160, overflowY: "auto" }}>
                  {commentFiles.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="flex items-center gap-2" style={{ fontSize: 12, background: BG_CARD, borderRadius: 6, padding: 8, flexShrink: 0 }}>
                      <Paperclip className="h-3 w-3" style={{ color: TEXT_SECONDARY, flexShrink: 0 }} />
                      <span className="truncate flex-1" style={{ color: TEXT_PRIMARY }}>{file.name}</span>
                      {/* Remove só esse arquivo, os outros anexados continuam —
                          não existe mais um "limpar tudo" de uma vez. */}
                      <button
                        type="button"
                        onClick={() => setCommentFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        title={`Remover ${file.name}`}
                        style={{ background: "none", border: "none", color: TEXT_MUTED, cursor: "pointer", flexShrink: 0 }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              // display:none (className="hidden") em cima de um input de
              // arquivo DENTRO de um Radix Dialog é um padrão conhecido por
              // não disparar o onChange de forma confiável em alguns
              // navegadores — o seletor do Windows abre normal, mas o
              // arquivo escolhido nunca chega no React (o chat flutuante,
              // que não é um Dialog, não tinha esse problema com o mesmo
              // padrão). Estilo "visualmente oculto" (sem display:none)
              // resolve mantendo o elemento de fato presente/interativo.
              style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) pickFiles(files);
              }}
            />
            <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
              <div className="flex items-center gap-3">
                {!readOnly && (
                  <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: isInternal ? "var(--mg-color-status-warning)" : TEXT_SECONDARY, cursor: "pointer" }}>
                    <span
                      onClick={() => setIsInternal((v) => !v)}
                      style={{
                        width: 32, height: 18, borderRadius: 999, position: "relative", display: "inline-block",
                        background: isInternal ? "var(--mg-color-status-warning)" : BORDER_DEFAULT, transition: "background 120ms ease",
                      }}
                    >
                      <span style={{ position: "absolute", top: 2, left: isInternal ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: TEXT_PRIMARY, transition: "left 120ms ease" }} />
                    </span>
                    Nota interna
                  </label>
                )}
                {/* Antes era só um ícone de 14px (Upload) sem rótulo, do
                    mesmo cinza discreto do resto da barra — na prática
                    invisível/confundido com decoração ("nem aparece símbolo
                    de anexo"). Clipe + texto deixa claro que é clicável. */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar arquivo"
                  style={{ background: "none", border: "none", color: TEXT_SECONDARY, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}
                >
                  <Paperclip className="h-4 w-4" />
                  Anexar
                </button>
              </div>
              <button
                type="button"
                onClick={() => addComment.mutate()}
                disabled={(!commentText.trim() && commentFiles.length === 0) || addComment.isPending}
                style={{
                  height: 36, padding: "0 18px", background: GOLD, color: "var(--mg-color-bg-base)", border: "none",
                  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  opacity: (!commentText.trim() && commentFiles.length === 0) || addComment.isPending ? 0.5 : 1,
                }}
              >
                Enviar <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        {activeTab !== "mensagens" && <div style={{ paddingBottom: 22 }} />}
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
          <ShadSelect value={sectorAssigneeId} onValueChange={setSectorAssigneeId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione um responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Nenhum</SelectItem>
              {pendingSectorProfiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
              ))}
            </SelectContent>
          </ShadSelect>
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

    <ReopenReasonDialog
      open={pendingReopenStatus !== null}
      onOpenChange={(o) => { if (!o) setPendingReopenStatus(null); }}
      isPending={reopenTicket.isPending}
      onConfirm={(reason) => {
        if (pendingReopenStatus) reopenTicket.mutate({ targetStatus: pendingReopenStatus, reason });
      }}
    />

    {/* Preview de imagem — Dialog do Radix aninhado dentro do modal do
        chamado (não um <div fixed>/portal manual). Radix já sabe resolver
        essa hierarquia direito: Esc ou clicar fora fecham só a camada de
        cima, sem precisar de nenhum onEscapeKeyDown/onPointerDownOutside
        na mão — o próprio Portal do Dialog vai pro <body>, então também
        não sofre do problema de containing block do DialogContent de fora. */}
    <Dialog open={!!previewImage} onOpenChange={(o) => { if (!o) setPreviewImage(null); }}>
      <DialogContent
        className="w-auto max-w-[95vw] border-none bg-transparent p-0 shadow-none [&>button]:h-9 [&>button]:w-9 [&>button]:rounded-full [&>button]:bg-black/50 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-black/70 [&>button]:hover:text-white"
      >
        <DialogTitle className="sr-only">{previewImage?.alt || "Visualizar imagem"}</DialogTitle>
        {previewImage && (
          <img
            src={previewImage.url}
            alt={previewImage.alt}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
