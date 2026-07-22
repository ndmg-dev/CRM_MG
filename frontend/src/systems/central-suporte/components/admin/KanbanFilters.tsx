import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@suporte/components/ui/select";
import { Button } from "@suporte/components/ui/button";
import { Filter, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";

export interface KanbanFilterValues {
  priority: string;
  categoryId: string;
  assigneeId: string;
  sectorId: string;
}

interface KanbanFiltersProps {
  filters: KanbanFilterValues;
  onChange: (filters: KanbanFilterValues) => void;
  isCoordinator?: boolean;
  isCoordinatorTI?: boolean;
  isDirection?: boolean;
  isAdmin?: boolean;
}

const priorityOptions = [
  { value: "p0", label: "P0 - Crítica" },
  { value: "p1", label: "P1 - Alta" },
  { value: "p2", label: "P2 - Média" },
  { value: "p3", label: "P3 - Baixa" },
];

export function KanbanFilters({ filters, onChange, isCoordinator, isCoordinatorTI, isDirection, isAdmin }: KanbanFiltersProps) {
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!(isDirection || isCoordinatorTI || isAdmin),
  });

  const { data: staffProfiles } = useQuery({
    queryKey: ["staff-profiles"],
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
      return data;
    },
  });

  const hasFilters = filters.priority || filters.categoryId || filters.assigneeId || filters.sectorId;

  const clearFilters = () => onChange({ priority: "", categoryId: "", assigneeId: "", sectorId: "" });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="h-4 w-4 text-muted-foreground" />

      <Select value={filters.priority || "all"} onValueChange={(v) => onChange({ ...filters, priority: v === "all" ? "" : v })}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas prioridades</SelectItem>
          {priorityOptions.map(p => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.categoryId || "all"} onValueChange={(v) => onChange({ ...filters, categoryId: v === "all" ? "" : v })}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas categorias</SelectItem>
          <SelectItem value="__tasks__">Tarefas</SelectItem>
          {categories?.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(isCoordinator || isDirection || isAdmin) && (
        <Select value={filters.assigneeId || "all"} onValueChange={(v) => onChange({ ...filters, assigneeId: v === "all" ? "" : v })}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            <SelectItem value="unassigned">Sem responsável</SelectItem>
            {staffProfiles?.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {(isDirection || isCoordinatorTI || isAdmin) && (
        <Select value={filters.sectorId || "all"} onValueChange={(v) => onChange({ ...filters, sectorId: v === "all" ? "" : v })}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos setores</SelectItem>
            {sectors?.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
          <X className="h-3 w-3 mr-1" /> Limpar
        </Button>
      )}
    </div>
  );
}

