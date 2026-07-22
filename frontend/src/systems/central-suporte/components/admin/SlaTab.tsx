import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Badge } from "@suporte/components/ui/badge";
import { Button } from "@suporte/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SlaFormDialog } from "./SlaFormDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { toast } from "sonner";

export function SlaTab() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSla, setEditingSla] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: slaPolicies, isLoading } = useQuery({
    queryKey: ["admin-sla"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_policies")
        .select("*")
        .order("priority");
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("sla_policies").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Política de SLA excluída");
      queryClient.invalidateQueries({ queryKey: ["admin-sla"] });
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Políticas de SLA</CardTitle>
            <CardDescription>Tempos de resposta e resolução por prioridade</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setEditingSla(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova Política
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Carregando...</p>
          ) : slaPolicies && slaPolicies.length > 0 ? (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Prioridade</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Resposta (h)</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Resolução (h)</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {slaPolicies.map((sla) => (
                    <tr key={sla.id} className="border-b last:border-0">
                      <td className="p-3 text-sm font-medium">{sla.name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="uppercase">{sla.priority}</Badge>
                      </td>
                      <td className="p-3 text-sm">{sla.response_time_hours}h</td>
                      <td className="p-3 text-sm">{sla.resolution_time_hours}h</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingSla(sla); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(sla)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border p-4 text-center text-muted-foreground">
              Nenhuma política de SLA cadastrada
            </div>
          )}
        </CardContent>
      </Card>

      <SlaFormDialog open={formOpen} onOpenChange={setFormOpen} sla={editingSla} />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir Política de SLA"
        description={`Deseja excluir a política "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}

