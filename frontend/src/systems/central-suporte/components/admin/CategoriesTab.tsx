import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Button } from "@suporte/components/ui/button";
import { Badge } from "@suporte/components/ui/badge";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { toast } from "sonner";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { SubcategoryFormDialog } from "./SubcategoryFormDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

const priorityLabels: Record<string, string> = { p0: "Crítico", p1: "Alta", p2: "Média", p3: "Baixa" };

export function CategoriesTab() {
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*, subcategories(*)")
        .order("name");
      if (error) throw error;
      return data;
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

  const { data: allCategorySectors } = useQuery({
    queryKey: ["category-sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("category_sectors").select("*");
      if (error) throw error;
      return data;
    },
  });

  const getSectorNames = (categoryId: string) => {
    const sectorIds = allCategorySectors?.filter(cs => cs.category_id === categoryId).map(cs => cs.sector_id) || [];
    return sectors?.filter(s => sectorIds.includes(s.id)).map(s => s.name) || [];
  };

  // Fetch staff profiles for displaying assignee names
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

  const getAssigneeName = (id: string | null | undefined) => {
    if (!id) return null;
    const p = staffProfiles?.find(s => s.id === id);
    return p?.full_name || p?.email || null;
  };

  // Category dialogs
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [deleteCatOpen, setDeleteCatOpen] = useState(false);
  const [deletingCat, setDeletingCat] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Subcategory dialogs
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subParent, setSubParent] = useState<{ id: string; name: string } | null>(null);
  const [editingSub, setEditingSub] = useState<any>(null);
  const [deleteSubOpen, setDeleteSubOpen] = useState(false);
  const [deletingSub, setDeletingSub] = useState<any>(null);

  const handleDeleteCategory = async () => {
    if (!deletingCat) return;
    setDeleteLoading(true);
    try {
      // Delete subcategories first
      await supabase.from("subcategories").delete().eq("category_id", deletingCat.id);
      const { error } = await supabase.from("categories").delete().eq("id", deletingCat.id);
      if (error) throw error;
      toast.success("Categoria excluída");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setDeleteCatOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSubcategory = async () => {
    if (!deletingSub) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("subcategories").delete().eq("id", deletingSub.id);
      if (error) throw error;
      toast.success("Subcategoria excluída");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setDeleteSubOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Categorias e Subcategorias</CardTitle>
            <CardDescription>Organize os tipos de chamados</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setEditingCat(null); setCatDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova Categoria
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Carregando...</p>
          ) : categories && categories.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => (
                <Card key={cat.id} className="p-4 border bg-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{cat.name}</h3>
                      {getSectorNames(cat.id).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {getSectorNames(cat.id).map(sName => (
                            <Badge key={sName} variant="secondary" className="text-[9px] px-1 py-0">
                              <Building2 className="h-2.5 w-2.5 mr-0.5" />{sName}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {(cat as any).default_priority && (
                        <Badge variant="outline" className="text-[10px] mt-1">
                          Prioridade: {priorityLabels[(cat as any).default_priority] || (cat as any).default_priority}
                        </Badge>
                      )}
                      {getAssigneeName((cat as any).default_assignee_id) && (
                        <Badge variant="outline" className="text-[10px] mt-1">
                          Responsável: {getAssigneeName((cat as any).default_assignee_id)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCat(cat); setCatDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { setDeletingCat(cat); setDeleteCatOpen(true); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {cat.description && (
                    <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                  )}
                  <div className="mt-3 space-y-1">
                    {cat.subcategories?.length > 0 ? cat.subcategories
                      .sort((a: any, b: any) => a.name.localeCompare(b.name))
                      .map((sub: any) => (
                        <div key={sub.id} className="flex items-center justify-between group">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                            {sub.name}
                            {sub.default_priority && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                {priorityLabels[sub.default_priority] || sub.default_priority}
                              </Badge>
                            )}
                            {getAssigneeName(sub.default_assignee_id) && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                {getAssigneeName(sub.default_assignee_id)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSubParent({ id: cat.id, name: cat.name }); setEditingSub(sub); setSubDialogOpen(true); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => { setDeletingSub(sub); setDeleteSubOpen(true); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )) : (
                        <p className="text-xs text-muted-foreground">Sem subcategorias</p>
                      )}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {cat.subcategories?.length || 0} subcategoria(s)
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSubParent({ id: cat.id, name: cat.name }); setEditingSub(null); setSubDialogOpen(true); }}>
                      <Plus className="h-3 w-3 mr-1" /> Subcategoria
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-md border p-4 text-center text-muted-foreground">
              Nenhuma categoria cadastrada
            </div>
          )}
        </CardContent>
      </Card>

      <CategoryFormDialog open={catDialogOpen} onOpenChange={setCatDialogOpen} category={editingCat} />

      {subParent && (
        <SubcategoryFormDialog
          open={subDialogOpen}
          onOpenChange={setSubDialogOpen}
          categoryId={subParent.id}
          categoryName={subParent.name}
          subcategory={editingSub}
        />
      )}

      <DeleteConfirmDialog
        open={deleteCatOpen}
        onOpenChange={setDeleteCatOpen}
        title="Excluir Categoria"
        description={`Tem certeza que deseja excluir "${deletingCat?.name}"? Todas as subcategorias serão removidas.`}
        onConfirm={handleDeleteCategory}
        loading={deleteLoading}
      />

      <DeleteConfirmDialog
        open={deleteSubOpen}
        onOpenChange={setDeleteSubOpen}
        title="Excluir Subcategoria"
        description={`Tem certeza que deseja excluir "${deletingSub?.name}"?`}
        onConfirm={handleDeleteSubcategory}
        loading={deleteLoading}
      />
    </>
  );
}

