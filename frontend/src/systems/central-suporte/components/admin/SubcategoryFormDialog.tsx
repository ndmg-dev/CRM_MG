import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@suporte/components/ui/dialog";
import { Button } from "@suporte/components/ui/button";
import { Input } from "@suporte/components/ui/input";
import { Label } from "@suporte/components/ui/label";
import { Switch } from "@suporte/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { supabase } from "@suporte/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const priorityOptions = [
  { value: "", label: "Herdar da categoria" },
  { value: "p0", label: "P0 – Crítico" },
  { value: "p1", label: "P1 – Alta" },
  { value: "p2", label: "P2 – Média" },
  { value: "p3", label: "P3 – Baixa" },
];

interface SubcategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  subcategory?: { id: string; name: string; requires_approval: boolean | null; default_priority?: string | null; default_assignee_id?: string | null } | null;
}

export function SubcategoryFormDialog({ open, onOpenChange, categoryId, categoryName, subcategory }: SubcategoryFormDialogProps) {
  const [name, setName] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [defaultPriority, setDefaultPriority] = useState("");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const isEdit = !!subcategory;

  // Responsável padrão: colaboradores dos setores vinculados à categoria-pai
  // (não mais por cargo de TI).
  const { data: staffProfiles } = useQuery({
    queryKey: ["profiles-by-category-sector", categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data: cs, error: csError } = await supabase
        .from("category_sectors")
        .select("sector_id")
        .eq("category_id", categoryId);
      if (csError) throw csError;
      const sectorIds = (cs || []).map((r) => r.sector_id);
      if (sectorIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, sector_id")
        .in("sector_id", sectorIds)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!categoryId,
  });

  useEffect(() => {
    if (subcategory) {
      setName(subcategory.name);
      setRequiresApproval(subcategory.requires_approval || false);
      setDefaultPriority(subcategory.default_priority || "");
      setDefaultAssigneeId(subcategory.default_assignee_id || "");
    } else {
      setName("");
      setRequiresApproval(false);
      setDefaultPriority("");
      setDefaultAssigneeId("");
    }
  }, [subcategory, open]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        requires_approval: requiresApproval,
        default_priority: defaultPriority || null,
        default_assignee_id: defaultAssigneeId || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("subcategories").update(payload).eq("id", subcategory!.id);
        if (error) throw error;
        toast.success("Subcategoria atualizada");
      } else {
        const { error } = await supabase.from("subcategories").insert({ ...payload, category_id: categoryId });
        if (error) throw error;
        toast.success("Subcategoria criada");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar subcategoria");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Subcategoria" : `Nova Subcategoria em "${categoryName}"`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sub-name">Nome</Label>
            <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: G Click" />
          </div>
          <div className="space-y-2">
            <Label>Prioridade padrão</Label>
            <Select value={defaultPriority || "none"} onValueChange={(v) => setDefaultPriority(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Herdar da categoria" />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((opt) => (
                  <SelectItem key={opt.value || "none"} value={opt.value || "none"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Responsável padrão</Label>
            <Select value={defaultAssigneeId || "none"} onValueChange={(v) => setDefaultAssigneeId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Herdar da categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Herdar da categoria</SelectItem>
                {staffProfiles?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sub-approval">Requer aprovação</Label>
            <Switch id="sub-approval" checked={requiresApproval} onCheckedChange={setRequiresApproval} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

