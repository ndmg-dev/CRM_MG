import { useNavigate } from "@suporte/lib/router-shim";
import { Button } from "@suporte/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Input } from "@suporte/components/ui/input";
import { Label } from "@suporte/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { Textarea } from "@suporte/components/ui/textarea";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { toast } from "sonner";

const TI_SECTOR_ID = "dd55f61b-0754-475e-8ea6-2eb0c79b68d6";

const NewTicketTI = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [files, setFiles] = useState<FileList | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories-by-sector", TI_SECTOR_ID],
    queryFn: async () => {
      const { data: catSectors, error: csError } = await supabase
        .from("category_sectors")
        .select("category_id")
        .eq("sector_id", TI_SECTOR_ID);
      if (csError) throw csError;

      if (!catSectors || catSectors.length === 0) {
        const { data: allLinked, error: allError } = await supabase
          .from("category_sectors")
          .select("category_id");
        if (allError) throw allError;
        const linkedIds = new Set((allLinked || []).map(c => c.category_id));
        const { data: allCats, error: catError } = await supabase.from("categories").select("*").order("name");
        if (catError) throw catError;
        return (allCats || []).filter(c => !linkedIds.has(c.id));
      }

      const categoryIds = catSectors.map(cs => cs.category_id);
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .in("id", categoryIds)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: subcategories } = useQuery({
    queryKey: ["subcategories", selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const { data, error } = await supabase
        .from("subcategories")
        .select("*")
        .eq("category_id", selectedCategory)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCategory,
  });

  // Resolve assignee and priority from category/subcategory defaults
  const resolveDefaults = () => {
    const category = categories?.find(c => c.id === selectedCategory);
    const subcategory = subcategories?.find(s => s.id === selectedSubcategory);

    // Subcategory defaults take precedence over category defaults
    const assigneeId = subcategory?.default_assignee_id || category?.default_assignee_id || null;
    const priority = subcategory?.default_priority || category?.default_priority || "p3";

    return { assigneeId, priority };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const title = formData.get("subject") as string;
      const description = formData.get("description") as string;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { assigneeId, priority } = resolveDefaults();

      if (assigneeId && assigneeId === user.id) {
        toast.error("Você não pode abrir um chamado para si mesmo.");
        setLoading(false);
        return;
      }

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          title,
          description,
          type: "request" as const,
          category_id: selectedCategory || null,
          subcategory_id: selectedSubcategory || null,
          target_sector_id: TI_SECTOR_ID,
          assignee_id: assigneeId,
          requester_id: user.id,
          status: "new",
          priority: priority as any,
        } as any)
        .select()
        .single();

      if (ticketError) throw ticketError;

      // AI Priority Classification (non-blocking, only if no default priority was set)
      const categoryName = categories?.find(c => c.id === selectedCategory)?.name;
      const subcategoryName = subcategories?.find(s => s.id === selectedSubcategory)?.name;
      const hasDefaultPriority = !!(subcategories?.find(s => s.id === selectedSubcategory)?.default_priority || categories?.find(c => c.id === selectedCategory)?.default_priority);

      if (!hasDefaultPriority) {
        supabase.functions.invoke("classify-priority", {
          body: { title, description, type: "request", category: categoryName, subcategory: subcategoryName },
        }).then(async ({ data: aiResult, error: aiError }) => {
          if (!aiError && aiResult?.priority && aiResult.priority !== "p3") {
            await supabase
              .from("tickets")
              .update({ priority: aiResult.priority as any })
              .eq("id", ticket.id);
          }
        }).catch(console.error);
      }

      // Upload Files
      if (files && files.length > 0) {
        for (const file of Array.from(files)) {
          const fileExt = file.name.split(".").pop();
          const filePath = `${ticket.id}/${crypto.randomUUID()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("ticket-attachments")
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { error: attachmentError } = await supabase
            .from("attachments")
            .insert({
              ticket_id: ticket.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
              uploaded_by: user.id,
            });

          if (attachmentError) throw attachmentError;
        }
      }

      toast.success("Chamado TI criado com sucesso!");
      navigate("/portal");
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      toast.error("Erro ao criar chamado: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Chamado TI</h2>
        <p className="text-muted-foreground">Abra um chamado para o setor de Tecnologia da Informação</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Chamado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  onValueChange={(v) => { setSelectedCategory(v); setSelectedSubcategory(""); }}
                  value={selectedCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory && subcategories && subcategories.length > 0 && (
                <div className="space-y-2">
                  <Label>Subcategoria</Label>
                  <Select
                    onValueChange={setSelectedSubcategory}
                    value={selectedSubcategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories?.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Assunto</Label>
              <Input
                name="subject"
                id="subject"
                placeholder="Resumo breve do problema"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição Detalhada</Label>
              <Textarea
                name="description"
                id="description"
                placeholder="Descreva o que aconteceu, passos para reproduzir, mensagens de erro..."
                className="min-h-[150px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="files">Anexos</Label>
              <Input
                id="files"
                type="file"
                multiple
                className="cursor-pointer"
                onChange={(e) => setFiles(e.target.files)}
              />
              <p className="text-xs text-muted-foreground">Prints de tela ajudam muito na resolução.</p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate("/portal")}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Enviando..." : "Abrir Chamado TI"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewTicketTI;


