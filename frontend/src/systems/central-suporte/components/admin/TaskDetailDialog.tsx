import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@suporte/components/ui/dialog";
import { Badge } from "@suporte/components/ui/badge";
import { Button } from "@suporte/components/ui/button";
import { Checkbox } from "@suporte/components/ui/checkbox";
import { Separator } from "@suporte/components/ui/separator";
import { ScrollArea } from "@suporte/components/ui/scroll-area";
import {
  Clock, User, CheckCircle2, Upload, Download, FileText, Image, Paperclip, Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { toast } from "sonner";

interface ChecklistItem {
  text: string;
  checked: boolean;
}

interface TaskDetailDialogProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({ taskId, open, onOpenChange }: TaskDetailDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: task } = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("task_instances")
        .select("*, assignee:profiles!assignee_id(full_name, email)")
        .eq("id", taskId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId && open,
  });

  const { data: attachments } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_instance_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const withUrls = await Promise.all(
        (data || []).map(async (att) => {
          const { data: urlData } = await supabase.storage
            .from("task-attachments")
            .createSignedUrl(att.file_path, 3600);
          return { ...att, signedUrl: urlData?.signedUrl || null };
        })
      );
      return withUrls;
    },
    enabled: !!taskId && open,
  });

  const updateChecklist = useMutation({
    mutationFn: async (checklist: ChecklistItem[]) => {
      if (!taskId) return;
      const { error } = await supabase
        .from("task_instances")
        .update({ checklist: checklist as any })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-instances"] });
    },
    onError: () => toast.error("Erro ao atualizar checklist"),
  });

  const toggleComplete = useMutation({
    mutationFn: async () => {
      if (!taskId || !task) return;
      const newStatus = task.status === "completed" ? "pending" : "completed";
      const { error } = await supabase
        .from("task_instances")
        .update({
          status: newStatus,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-instances"] });
      toast.success(task?.status === "completed" ? "Tarefa reaberta" : "Tarefa concluída!");
    },
    onError: () => toast.error("Erro ao atualizar tarefa"),
  });

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      if (!taskId) return;
      const { data: { user } } = await supabase.auth.getUser();
      const filePath = `${taskId}/${crypto.randomUUID()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("task-attachments")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { error } = await supabase.from("task_attachments").insert({
        task_instance_id: taskId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success("Anexo enviado");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: () => toast.error("Erro ao enviar anexo"),
  });

  if (!task) return null;

  const checklist: ChecklistItem[] = (Array.isArray(task.checklist) ? task.checklist : []).map((item: any) => ({
    text: item.text || "",
    checked: !!item.checked,
  }));

  const toggleCheckItem = (idx: number) => {
    const updated = checklist.map((item, i) =>
      i === idx ? { ...item, checked: !item.checked } : item
    );
    updateChecklist.mutate(updated);
  };

  const completedCount = checklist.filter(c => c.checked).length;
  const isCompleted = task.status === "completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant={isCompleted ? "default" : "secondary"}>
              {isCompleted ? "Concluída" : "Pendente"}
            </Badge>
            {task.due_date && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(task.due_date).toLocaleString("pt-BR")}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg mt-2">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {task.description && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">{task.description}</div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Responsável: <strong className="text-foreground">{task.assignee?.full_name || "—"}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Criada: <strong className="text-foreground">{new Date(task.created_at!).toLocaleString("pt-BR")}</strong></span>
            </div>
            {task.completed_at && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Concluída em: <strong className="text-foreground">{new Date(task.completed_at).toLocaleString("pt-BR")}</strong></span>
              </div>
            )}
          </div>

          <Separator />

          {/* Checklist */}
          {checklist.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3">
                Checklist ({completedCount}/{checklist.length})
              </h4>
              <div className="space-y-2">
                {checklist.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 rounded-lg p-2 text-sm cursor-pointer transition-colors ${
                      item.checked ? "bg-green-500/10" : "bg-muted/50"
                    }`}
                    onClick={() => toggleCheckItem(idx)}
                  >
                    <Checkbox checked={item.checked} onCheckedChange={() => toggleCheckItem(idx)} />
                    <span className={item.checked ? "line-through text-muted-foreground" : ""}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Attachments */}
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Paperclip className="h-4 w-4" /> Anexos ({attachments?.length || 0})
            </h4>
            {attachments && attachments.length > 0 && (
              <div className="space-y-2 mb-3">
                {attachments.map((att) => {
                  const isImg = att.file_type?.startsWith("image/");
                  return (
                    <div key={att.id}>
                      <div className="flex items-center gap-2 text-sm rounded-lg border bg-muted/30 p-2">
                        {isImg ? <Image className="h-4 w-4 text-blue-400 shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="truncate flex-1">{att.file_name}</span>
                        {att.signedUrl && (
                          <a href={att.signedUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                      {isImg && att.signedUrl && (
                        <a href={att.signedUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
                          <img src={att.signedUrl} alt={att.file_name} className="rounded border max-h-32 object-contain" />
                        </a>
                      )}
                    </div>
                  );
                })}
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
                  uploadAttachment.mutate(file);
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAttachment.isPending}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              {uploadAttachment.isPending ? "Enviando..." : "Anexar arquivo"}
            </Button>
          </div>

          <Separator />

          {/* Complete/Reopen */}
          <Button
            className="w-full"
            variant={isCompleted ? "outline" : "default"}
            onClick={() => toggleComplete.mutate()}
            disabled={toggleComplete.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isCompleted ? "Reabrir Tarefa" : "Marcar como Concluída"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

