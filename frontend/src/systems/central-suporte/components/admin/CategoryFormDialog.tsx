import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@suporte/components/ui/dialog";
import { Button } from "@suporte/components/ui/button";
import { Input } from "@suporte/components/ui/input";
import { Label } from "@suporte/components/ui/label";
import { Textarea } from "@suporte/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { Checkbox } from "@suporte/components/ui/checkbox";
import { supabase } from "@suporte/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const priorityOptions = [
  { value: "", label: "Nenhuma (definida pela IA)" },
  { value: "p0", label: "P0 – Crítico" },
  { value: "p1", label: "P1 – Alta" },
  { value: "p2", label: "P2 – Média" },
  { value: "p3", label: "P3 – Baixa" },
];

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: { id: string; name: string; description: string | null; default_priority?: string | null; default_assignee_id?: string | null } | null;
}

export function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultPriority, setDefaultPriority] = useState("");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState("");
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const isEdit = !!category;

  const { data: staffProfiles } = useQuery({
    queryKey: ["staff-profiles-categories"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["support_agent", "dev", "admin_ti", "coordinator"]);
      if (rolesError) throw rolesError;
      if (!roles?.length) return [];
      const uniqueIds = [...new Set(roles.map(r => r.user_id))];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", uniqueIds);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: categorySectors } = useQuery({
    queryKey: ["category-sectors", category?.id],
    queryFn: async () => {
      if (!category?.id) return [];
      const { data, error } = await supabase
        .from("category_sectors")
        .select("sector_id")
        .eq("category_id", category.id);
      if (error) throw error;
      return data?.map(cs => cs.sector_id) || [];
    },
    enabled: !!category?.id,
  });

  useEffect(() => {
    if (category) {
      setName(category.name);
      setDescription(category.description || "");
      setDefaultPriority(category.default_priority || "");
      setDefaultAssigneeId(category.default_assignee_id || "");
      setSelectedSectorIds(categorySectors || []);
    } else {
      setName("");
      setDescription("");
      setDefaultPriority("");
      setDefaultAssigneeId("");
      setSelectedSectorIds([]);
    }
  }, [category, open, categorySectors]);

  const toggleSector = (sectorId: string) => {
    setSelectedSectorIds(prev =>
      prev.includes(sectorId) ? prev.filter(id => id !== sectorId) : [...prev, sectorId]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        default_priority: defaultPriority || null,
        default_assignee_id: defaultAssigneeId || null,
      };

      let categoryId: string;

      if (isEdit) {
        const { error } = await supabase.from("categories").update(payload).eq("id", category!.id);
        if (error) throw error;
        categoryId = category!.id;
        toast.success("Categoria atualizada");
      } else {
        const { data, error } = await supabase.from("categories").insert(payload).select("id").single();
        if (error) throw error;
        categoryId = data.id;
        toast.success("Categoria criada");
      }

      // Sync category_sectors
      await supabase.from("category_sectors").delete().eq("category_id", categoryId);
      if (selectedSectorIds.length > 0) {
        const rows = selectedSectorIds.map(sector_id => ({ category_id: categoryId, sector_id }));
        const { error: csError } = await supabase.from("category_sectors").insert(rows as any);
        if (csError) throw csError;
      }

      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["category-sectors"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar categoria");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nome</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sistemas" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-desc">Descrição (opcional)</Label>
            <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da categoria" rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Setores vinculados</Label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
              {sectors?.map((sector) => (
                <div key={sector.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`sector-${sector.id}`}
                    checked={selectedSectorIds.includes(sector.id)}
                    onCheckedChange={() => toggleSector(sector.id)}
                  />
                  <Label htmlFor={`sector-${sector.id}`} className="text-sm font-normal cursor-pointer">
                    {sector.name}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Selecione os setores que podem usar esta categoria</p>
          </div>
          <div className="space-y-2">
            <Label>Prioridade padrão</Label>
            <Select value={defaultPriority || "none"} onValueChange={(v) => setDefaultPriority(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma (definida pela IA)" />
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
                <SelectValue placeholder="Nenhum (atribuição automática)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (atribuição automática)</SelectItem>
                {staffProfiles?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

