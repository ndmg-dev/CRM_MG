import { useNavigate } from "@suporte/lib/router-shim";
import { Button } from "@suporte/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Input } from "@suporte/components/ui/input";
import { Label } from "@suporte/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { Textarea } from "@suporte/components/ui/textarea";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { toast } from "sonner";

const NewTicket = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [files, setFiles] = useState<FileList | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-id-newticket"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
  });

  const sectorAndAssigneeSelected = !!selectedSector && !!selectedAssignee;

  const TI_SECTOR_ID = "dd55f61b-0754-475e-8ea6-2eb0c79b68d6";

  const { data: sectors } = useQuery({
    queryKey: ["sectors-no-ti"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").neq("id", TI_SECTOR_ID).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch categories filtered by the selected sector
  const { data: categories } = useQuery({
    queryKey: ["categories-by-sector", selectedSector],
    queryFn: async () => {
      if (!selectedSector) return [];
      // Get category IDs linked to this sector
      const { data: catSectors, error: csError } = await supabase
        .from("category_sectors")
        .select("category_id")
        .eq("sector_id", selectedSector);
      if (csError) throw csError;

      if (!catSectors || catSectors.length === 0) {
        // Fallback: show categories with no sector link (unlinked = available to all)
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
    enabled: !!selectedSector,
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

  const { data: sectorUsers } = useQuery({
    queryKey: ["sector-users", selectedSector],
    queryFn: async () => {
      if (!selectedSector) return [];
      const { data: users, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("sector_id", selectedSector)
        .order("full_name");
      if (error) throw error;

      // Exclude users with viewer role
      const { data: viewerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "viewer");
      const viewerIds = new Set((viewerRoles || []).map(r => r.user_id));

      return (users || []).filter(u => !viewerIds.has(u.id));
    },
    enabled: !!selectedSector,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const title = formData.get("subject") as string;
      const description = formData.get("description") as string;
      const type = "request" as const;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (selectedAssignee && selectedAssignee === user.id) {
        toast.error("Você não pode abrir um chamado para si mesmo.");
        setLoading(false);
        return;
      }

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          title,
          description,
          type,
          category_id: selectedCategory || null,
          subcategory_id: selectedSubcategory || null,
          target_sector_id: selectedSector || null,
          assignee_id: selectedAssignee || null,
          requester_id: user.id,
          opened_by_id: user.id,
          status: "new",
          priority: "p3",
        } as any)
        .select()
        .single();

      if (ticketError) throw ticketError;

      // AI Priority Classification (non-blocking)
      const categoryName = categories?.find(c => c.id === selectedCategory)?.name;
      const subcategoryName = subcategories?.find(s => s.id === selectedSubcategory)?.name;
      
      supabase.functions.invoke("classify-priority", {
        body: { title, description, type, category: categoryName, subcategory: subcategoryName },
      }).then(async ({ data: aiResult, error: aiError }) => {
        if (!aiError && aiResult?.priority && aiResult.priority !== "p3") {
          // Só aplica se ninguém já tiver mudado a prioridade manualmente
          // enquanto a IA processava (ticket sempre nasce com "p3" aqui).
          await supabase
            .from("tickets")
            .update({ priority: aiResult.priority as any })
            .eq("id", ticket.id)
            .eq("priority", "p3");
        }
      }).catch(console.error);

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

      toast.success("Chamado criado com sucesso!");
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
        <h2 className="text-3xl font-bold tracking-tight">Novo Chamado</h2>
        <p className="text-muted-foreground">Descreva seu problema detalhadamente</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de Solicitação</Label>
                {/* Única opção existente hoje — sem dropdown falso pra
                    escolher algo que não tem outra alternativa. */}
                <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                  Requisição
                </div>
              </div>

              <div className="space-y-2">
                <Label>Enviar Para o Setor: <span className="text-destructive">*</span></Label>
                <Select value={selectedSector} onValueChange={(v) => { setSelectedSector(v); setSelectedAssignee(""); setSelectedCategory(""); setSelectedSubcategory(""); }} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSector && sectorUsers && sectorUsers.length > 0 && (
                <div className="space-y-2">
                  <Label>Enviar Chamado Para: <span className="text-destructive">*</span></Label>
                  <Select value={selectedAssignee} onValueChange={setSelectedAssignee} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o responsável..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sectorUsers
                        .filter((u) => u.id !== currentUser)
                        .map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select 
                  onValueChange={(v) => { setSelectedCategory(v); setSelectedSubcategory(""); }} 
                  value={selectedCategory}
                  disabled={!sectorAndAssigneeSelected}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!sectorAndAssigneeSelected ? "Selecione setor e responsável primeiro" : "Selecione..."} />
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
                    disabled={!sectorAndAssigneeSelected}
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
                placeholder={!sectorAndAssigneeSelected ? "Selecione setor e responsável primeiro" : "Resumo breve do problema"} 
                required 
                disabled={!sectorAndAssigneeSelected}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição Detalhada</Label>
              <Textarea 
                name="description"
                id="description" 
                placeholder={!sectorAndAssigneeSelected ? "Selecione setor e responsável primeiro" : "Descreva o que aconteceu, passos para reproduzir, mensagens de erro..."} 
                className="min-h-[150px]"
                disabled={!sectorAndAssigneeSelected}
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
                disabled={!sectorAndAssigneeSelected}
              />
              <p className="text-xs text-muted-foreground">Prints de tela ajudam muito na resolução.</p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate("/portal")}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={loading || !sectorAndAssigneeSelected}>
                {loading ? "Enviando..." : "Abrir Chamado"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewTicket;


