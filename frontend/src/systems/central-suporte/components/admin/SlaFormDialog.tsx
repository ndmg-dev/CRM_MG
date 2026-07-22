import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@suporte/components/ui/dialog";
import { Button } from "@suporte/components/ui/button";
import { Input } from "@suporte/components/ui/input";
import { Label } from "@suporte/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@suporte/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface SlaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sla?: {
    id: string;
    name: string;
    priority: string;
    response_time_hours: number;
    resolution_time_hours: number;
  } | null;
}

const PRIORITIES = [
  { value: "p0", label: "P0 - Crítica" },
  { value: "p1", label: "P1 - Alta" },
  { value: "p2", label: "P2 - Média" },
  { value: "p3", label: "P3 - Baixa" },
];

export function SlaFormDialog({ open, onOpenChange, sla }: SlaFormDialogProps) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("p3");
  const [responseHours, setResponseHours] = useState("");
  const [resolutionHours, setResolutionHours] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const isEditing = !!sla;

  useEffect(() => {
    if (sla) {
      setName(sla.name);
      setPriority(sla.priority);
      setResponseHours(String(sla.response_time_hours));
      setResolutionHours(String(sla.resolution_time_hours));
    } else {
      setName("");
      setPriority("p3");
      setResponseHours("");
      setResolutionHours("");
    }
  }, [sla, open]);

  const handleSubmit = async () => {
    if (!name.trim() || !responseHours || !resolutionHours) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        priority: priority as any,
        response_time_hours: Number(responseHours),
        resolution_time_hours: Number(resolutionHours),
      };

      if (isEditing) {
        const { error } = await supabase.from("sla_policies").update(payload).eq("id", sla.id);
        if (error) throw error;
        toast.success("Política de SLA atualizada");
      } else {
        const { error } = await supabase.from("sla_policies").insert(payload);
        if (error) throw error;
        toast.success("Política de SLA criada");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-sla"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar" : "Nova"} Política de SLA</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: SLA Crítico" />
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tempo de Resposta (h)</Label>
              <Input type="number" min="1" value={responseHours} onChange={(e) => setResponseHours(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tempo de Resolução (h)</Label>
              <Input type="number" min="1" value={resolutionHours} onChange={(e) => setResolutionHours(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

