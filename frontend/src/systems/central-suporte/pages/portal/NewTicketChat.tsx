import { useNavigate } from "@suporte/lib/router-shim";
import { Button } from "@suporte/components/ui/button";
import { Input } from "@suporte/components/ui/input";
import { Textarea } from "@suporte/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { toast } from "sonner";
import { Headset, Paperclip, Undo2, CheckCircle2, User, Pencil } from "lucide-react";
import { KanbanTicketCard } from "@suporte/components/admin/KanbanTicketCard";

const TI_SECTOR_ID = "dd55f61b-0754-475e-8ea6-2eb0c79b68d6";

// PROTÓTIPO / SÓ EM DEV: sem a sessão SSO do Supabase da Central (que só
// existe com o login Google real), o RLS devolve categoria/subcategoria
// vazias e não dá pra percorrer o fluxo localmente. Estes dados de exemplo
// aparecem SOMENTE em `npm run dev` e apenas quando a consulta real volta
// vazia — em produção (import.meta.env.DEV === false) nunca são usados.
// Remover junto com o protótipo quando a decisão for tomada.
const DEV_SAMPLE_CATEGORIES = [
  { id: "dev-acessos", name: "Acessos", default_assignee_id: null, default_priority: null },
  { id: "dev-rede", name: "Rede e conectividade", default_assignee_id: null, default_priority: null },
  { id: "dev-hardware", name: "Equipamentos", default_assignee_id: null, default_priority: null },
  { id: "dev-sistemas", name: "Sistemas", default_assignee_id: null, default_priority: null },
];

const DEV_SAMPLE_SUBCATEGORIES: Record<string, { id: string; name: string; default_assignee_id: null; default_priority: null }[]> = {
  "dev-acessos": [
    { id: "dev-drive", name: "Google Drive", default_assignee_id: null, default_priority: null },
    { id: "dev-email", name: "E-mail", default_assignee_id: null, default_priority: null },
    { id: "dev-senha", name: "Senha / bloqueio", default_assignee_id: null, default_priority: null },
  ],
  "dev-rede": [
    { id: "dev-wifi", name: "Wi-Fi", default_assignee_id: null, default_priority: null },
    { id: "dev-vpn", name: "VPN", default_assignee_id: null, default_priority: null },
  ],
  // "dev-hardware" e "dev-sistemas" ficam sem subcategoria de propósito —
  // é assim que dá pra testar o caminho que pula direto pra descrição.
};

const DEV_SAMPLE_SUBCATEGORIES_NAMES: Record<string, string[]> = Object.fromEntries(
  Object.entries(DEV_SAMPLE_SUBCATEGORIES).map(([catId, subs]) => [catId, subs.map(s => s.name)])
);

// Idem, pra testar "abrir pra outra pessoa" sem sessão real.
const DEV_SAMPLE_PEOPLE = [
  { id: "dev-person-1", full_name: "Maria Silva" },
  { id: "dev-person-2", full_name: "João Pereira" },
  { id: "dev-person-3", full_name: "Ana Costa" },
];

// "Prova de burro" pro problema real de produção: chamado de monitor caindo
// em "Outros" porque a pessoa não sabia que era "Hardware". Mostra exemplos
// concretos embaixo de cada categoria pra tirar a dúvida ANTES do clique —
// casada por nome (minúsculo, sem acento) pra tolerar variação de cadastro
// tipo "Rede/Conectividade" vs "Rede e Conectividade". Sem hint cadastrado,
// o chip aparece sem exemplo (nunca quebra por categoria nova/renomeada).
const DIACRITICS_PATTERN = new RegExp("[̀-ͯ]", "g");
function normalizeCategoryName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(DIACRITICS_PATTERN, "").trim();
}

const CATEGORY_HINTS: Record<string, string> = {
  "acessos": "senha, e-mail, Google Drive, login em sistema, permissão de pasta",
  "hardware": "monitor, teclado, mouse, impressora, notebook, computador, fone, cabo",
  "equipamentos": "monitor, teclado, mouse, impressora, notebook, computador, fone, cabo",
  "rede/conectividade": "Wi-Fi, internet lenta ou fora do ar, VPN, cabo de rede",
  "rede e conectividade": "Wi-Fi, internet lenta ou fora do ar, VPN, cabo de rede",
  "sistemas": "sistema jurídico, ERP, sistema de terceiro, erro ao logar/usar um sistema",
  "desenvolvimento": "automação, integração entre sistemas, relatório sob medida, bug em algo feito internamente",
  "outros": "só escolha esta se nenhuma das anteriores tiver relação com o problema",
};

/** Etapas do fluxo conversacional, em ordem. `done` = chamado já criado.
 * "requester"/"requester_person" resolvem quem é o dono do chamado ANTES da
 * categoria — é o problema real que motivou essa etapa: chamado aberto por
 * alguém em nome de outra pessoa ficava sempre parametrizado com quem abriu,
 * não com quem realmente precisa da TI. */
type Step = "requester" | "requester_person" | "category" | "subcategory" | "description" | "attachments" | "creating" | "done";

interface ChatEntry {
  from: "bot" | "user";
  text: string;
}

/** Identidade estável do anexo — dois prints colados no mesmo segundo ainda
 * se distinguem pelo tamanho, e nome+tamanho basta pra chavear a miniatura. */
const fileKey = (f: File) => `${f.name}:${f.size}`;

/** Assunto do chamado = categoria + subcategoria (ex.: "Equipamentos -
 * Monitor"). Sem subcategoria (categoria que pula direto pra descrição),
 * fica só a categoria — a descrição completa do problema vai no corpo do
 * chamado, não precisa duplicar no título. */
function buildTitle(categoryName: string | undefined, subcategoryName: string | undefined): string {
  return [categoryName, subcategoryName].filter(Boolean).join(" - ");
}

/** Snapshot pra desfazer uma resposta e voltar um passo do fluxo. */
interface StepSnapshot {
  step: Step;
  historyLength: number;
  selectedRequesterId: string;
  selectedRequesterName: string;
  selectedCategory: string;
  selectedSubcategory: string;
}

const Bubble = ({ entry }: { entry: ChatEntry }) => (
  <div className={`flex items-end gap-2 ${entry.from === "user" ? "justify-end" : "justify-start"}`}>
    {entry.from === "bot" && (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
        <Headset className="h-3.5 w-3.5" />
      </div>
    )}
    <div
      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        entry.from === "user"
          ? "rounded-br-sm bg-primary font-medium text-primary-foreground"
          : "rounded-bl-sm border border-border bg-muted/60 text-foreground"
      }`}
    >
      {entry.text}
    </div>
  </div>
);

/** Opção clicável do fluxo (categoria/subcategoria) — dourado do sistema. */
const Chip = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="rounded-full border border-primary/40 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
  >
    {label}
  </button>
);

/** Categoria com exemplo embaixo — "prova de burro" pro caso real de
 * produção (chamado de monitor foi aberto como "Outros" por falta de
 * contexto). "Outros" vem visualmente apagado de propósito, pra não ser o
 * clique óbvio de quem está com pressa/dúvida. */
const CategoryChip = ({ label, hint, muted, onClick }: { label: string; hint?: string; muted?: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    // h-full + grid (o pai é `grid`) deixa todos os cards da mesma altura,
    // não importa se a lista de subcategorias de um é maior que a de outro.
    // line-clamp-2 corta a prévia em vez de esticar o card quando a
    // categoria tem muita subcategoria cadastrada.
    className={`flex h-full flex-col items-start gap-0.5 rounded-xl border px-4 py-2.5 text-left transition-colors ${
      muted
        ? "border-border bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground"
        : "border-primary/40 bg-primary/5 text-primary hover:border-primary hover:bg-primary/15"
    } focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
  >
    <span className="text-sm font-semibold">{label}</span>
    {hint && <span className="line-clamp-2 text-xs font-normal opacity-80">{hint}</span>}
  </button>
);

const NewTicketChat = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("category");
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [selectedRequesterId, setSelectedRequesterId] = useState<string>("");
  const [selectedRequesterName, setSelectedRequesterName] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [description, setDescription] = useState("");
  // File[] em vez de FileList: imagem colada do clipboard chega como File
  // avulso, e FileList é read-only (não dá pra ir acumulando).
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [createdCode, setCreatedCode] = useState<number | null>(null);
  // Pilha de estados anteriores — permite corrigir uma escolha errada sem
  // ter que abandonar o chamado e recomeçar do zero.
  const [undoStack, setUndoStack] = useState<StepSnapshot[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["current-profile-name"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("id, full_name").eq("id", user.id).single();
      return data;
    },
  });
  const firstName = (profile?.full_name || "").trim().split(" ")[0];

  // Lista pra "abrir pra outra pessoa" — mesma fonte que o admin usa em
  // TicketDetailDialog pra reatribuir chamado, então já respeita a mesma
  // RLS de quem pode ver quem.
  const { data: allProfiles } = useQuery({
    queryKey: ["all-profiles-for-requester"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: step === "requester_person",
    select: (data) =>
      import.meta.env.DEV && (!data || data.length === 0) ? (DEV_SAMPLE_PEOPLE as typeof data) : data,
  });
  const { data: categories, isLoading: catsLoading, error: catsError } = useQuery({
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
    select: (data) =>
      // Ver DEV_SAMPLE_CATEGORIES: só substitui quando o banco real veio
      // vazio E estamos em dev.
      import.meta.env.DEV && (!data || data.length === 0) ? (DEV_SAMPLE_CATEGORIES as typeof data) : data,
  });

  // Subcategorias de TODAS as categorias, só pra mostrar como prévia embaixo
  // de cada card na etapa de categoria — é o que resolve de vez o caso do
  // monitor virar "Outros": a pessoa já vê "monitor, teclado, mouse..."
  // embaixo de "Hardware" antes de escolher, sem precisar entrar e voltar.
  const categoryIds = (categories ?? []).map(c => c.id).filter(id => !id.startsWith("dev-"));
  const { data: allSubcategories } = useQuery({
    queryKey: ["subcategories-preview", categoryIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcategories")
        .select("category_id, name")
        .in("category_id", categoryIds)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: categoryIds.length > 0,
  });

  const subcategoryPreviewByCategory: Record<string, string[]> = { ...DEV_SAMPLE_SUBCATEGORIES_NAMES };
  for (const s of allSubcategories ?? []) {
    if (!s.category_id) continue;
    (subcategoryPreviewByCategory[s.category_id] ??= []).push(s.name);
  }

  const { data: subcategories, error: subsError } = useQuery({
    queryKey: ["subcategories", selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      // Ids de exemplo (dev) não existem no banco — devolve direto, senão a
      // consulta real volta vazia e o passo de subcategoria some no teste.
      if (import.meta.env.DEV && selectedCategory.startsWith("dev-")) {
        return DEV_SAMPLE_SUBCATEGORIES[selectedCategory] ?? []
      }
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

  const categoryLabel = categories?.find(c => c.id === selectedCategory)?.name;
  const subcategoryLabel = subcategories?.find(s => s.id === selectedSubcategory)?.name;

  // "Outros" sempre por último — não é pra ser a opção mais visível/fácil de
  // bater o olho quando a pessoa está em dúvida.
  const orderedCategories = [...(categories ?? [])].sort((a, b) => {
    const aOutros = normalizeCategoryName(a.name) === "outros";
    const bOutros = normalizeCategoryName(b.name) === "outros";
    if (aOutros === bOutros) return 0;
    return aOutros ? 1 : -1;
  });

  // Primeira fala do bot — espera o nome carregar pra não cumprimentar vazio.
  useEffect(() => {
    if (history.length === 0 && profile !== undefined) {
      setHistory([{ from: "bot", text: `Olá${firstName ? `, ${firstName}` : ""}! O que você precisa resolver hoje?` }]);
    }
  }, [profile, firstName, history.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, step]);

  function say(from: ChatEntry["from"], text: string) {
    setHistory(h => [...h, { from, text }]);
  }

  /** Guarda o estado ANTES de responder, pra poder desfazer depois. */
  function snapshot() {
    setUndoStack(s => [...s, {
      step, historyLength: history.length,
      selectedRequesterId, selectedRequesterName, selectedCategory, selectedSubcategory,
    }]);
  }

  function goBack() {
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    setUndoStack(s => s.slice(0, -1));
    setHistory(h => h.slice(0, prev.historyLength));
    setSelectedRequesterId(prev.selectedRequesterId);
    setSelectedRequesterName(prev.selectedRequesterName);
    setSelectedCategory(prev.selectedCategory);
    setSelectedSubcategory(prev.selectedSubcategory);
    setStep(prev.step);
  }

  /** Pergunta de descrição muda pelo nome de quem vai usar — só faz sentido
   * perguntar "descreva o SEU problema" se o chamado for pra quem está no
   * chat; pra outra pessoa, fica na 3ª pessoa. Único ponto que avança pro
   * passo "description", chamado pelos dois caminhos do passo "requester". */
  function askDescriptionQuestion(forSelf: boolean, name: string) {
    say("bot", forSelf
      ? "Descreva o problema com o máximo de detalhe que conseguir."
      : `Descreva o problema de ${name} com o máximo de detalhe que conseguir.`);
    setStep("description");
  }

  function pickRequesterSelf() {
    snapshot();
    const id = profile?.id ?? "";
    const name = profile?.full_name || firstName || "Você";
    setSelectedRequesterId(id);
    setSelectedRequesterName(name);
    say("user", "Para mim");
    askDescriptionQuestion(true, name);
  }

  function pickRequesterOther() {
    snapshot();
    say("user", "Para outra pessoa");
    say("bot", "Selecione a pessoa:");
    setStep("requester_person");
  }

  function pickRequesterPerson(id: string, name: string) {
    snapshot();
    setSelectedRequesterId(id);
    setSelectedRequesterName(name);
    say("user", name);
    askDescriptionQuestion(false, name);
  }

  /** Etapa "para quem é o chamado" — entre categoria/subcategoria e a
   * descrição do problema (ver useEffect de subcategoria e pickSubcategory,
   * os dois pontos que levam pra cá em vez de ir direto pra descrição). */
  function askRequesterQuestion() {
    say("bot", "Você está abrindo esse chamado para você ou para outra pessoa?");
    setStep("requester");
  }

  function pickCategory(id: string, name: string) {
    snapshot();
    setSelectedCategory(id);
    setSelectedSubcategory("");
    say("user", name);
  }

  // Só dá pra saber se tem subcategoria depois que a query resolve — decide
  // aqui (e não no clique) pra não perguntar algo que não existe.
  useEffect(() => {
    if (!selectedCategory || step !== "category") return;
    // Sem o caso de erro, uma falha aqui deixa `subcategories` undefined pra
    // sempre e o chat trava mudo depois de escolher a categoria — segue pra
    // descrição, que é o passo que realmente importa pro chamado.
    if (subcategories === undefined && !subsError) return; // ainda carregando
    if (subcategories && subcategories.length > 0) {
      say("bot", "Certo. Qual dessas opções descreve melhor?");
      setStep("subcategory");
    } else {
      askRequesterQuestion();
    }
  }, [selectedCategory, subcategories, subsError, step]);

  function pickSubcategory(id: string, name: string) {
    snapshot();
    setSelectedSubcategory(id);
    say("user", name);
    askRequesterQuestion();
  }

  function submitDescription() {
    const text = description.trim();
    if (!text) return;
    snapshot();
    say("user", text);
    say("bot", "Anexar um print ajuda muito a resolver mais rápido. Cole (Ctrl+V) ou escolha um arquivo.");
    setStep("attachments");
  }

  function addFiles(incoming: File[]) {
    if (!incoming.length) return;
    setAttachedFiles(prev => [...prev, ...incoming]);
    // Miniatura só faz sentido pra imagem; PDF/doc aparecem só pelo nome.
    for (const f of incoming) {
      if (!f.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(f);
      setPreviews(p => ({ ...p, [fileKey(f)]: url }));
    }
  }

  function removeFile(index: number) {
    const f = attachedFiles[index];
    const key = fileKey(f);
    if (previews[key]) {
      URL.revokeObjectURL(previews[key]);
      setPreviews(p => { const next = { ...p }; delete next[key]; return next });
    }
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }

  // Cola print direto (Ctrl+V) — o clipboard entrega a imagem como item de
  // tipo image/*, geralmente com o nome genérico "image.png"; renomeia com
  // timestamp pra não virar um monte de anexo com o mesmo nome no chamado.
  function handlePaste(e: React.ClipboardEvent) {
    const imageItems = Array.from(e.clipboardData.items).filter(i => i.type.startsWith("image/"));
    if (!imageItems.length) return;
    e.preventDefault();
    const pasted = imageItems
      .map(item => item.getAsFile())
      .filter((f): f is File => !!f)
      .map(f => new File([f], `print-${Date.now()}.${f.type.split("/")[1] || "png"}`, { type: f.type }));
    addFiles(pasted);
  }

  const resolveDefaults = () => {
    const category = categories?.find(c => c.id === selectedCategory);
    const subcategory = subcategories?.find(s => s.id === selectedSubcategory);
    const assigneeId = subcategory?.default_assignee_id || category?.default_assignee_id || null;
    const priority = subcategory?.default_priority || category?.default_priority || "p3";
    return { assigneeId, priority };
  };

  async function createTicket() {
    setStep("creating");

    // PROTÓTIPO / SÓ EM DEV: com as categorias de exemplo os ids não existem
    // no banco e não há sessão, então o insert real falharia. Simula o
    // desfecho pra dar pra avaliar o fluxo inteiro — e deixa explícito na
    // própria mensagem que NENHUM chamado foi aberto.
    if (import.meta.env.DEV && selectedCategory.startsWith("dev-")) {
      await new Promise(r => setTimeout(r, 600));
      say("bot", "⚠️ SIMULAÇÃO (dados de teste, nenhum chamado foi aberto de verdade). No ambiente real, seu chamado estaria aberto neste ponto e a TI já teria sido notificada.");
      setStep("done");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { assigneeId, priority } = resolveDefaults();
      if (assigneeId && assigneeId === user.id) {
        toast.error("Você não pode abrir um chamado para si mesmo.");
        setStep("attachments");
        return;
      }

      const categoryName = categories?.find(c => c.id === selectedCategory)?.name;
      const subcategoryName = subcategories?.find(s => s.id === selectedSubcategory)?.name;
      // O chat não pergunta "Assunto": ele é montado como categoria +
      // subcategoria (ambas vêm de escolha guiada, sempre válidas) — a
      // descrição do problema vai só no corpo do chamado.
      const title = buildTitle(categoryName, subcategoryName);

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          title,
          description: description.trim(),
          type: "request" as const,
          category_id: selectedCategory || null,
          subcategory_id: selectedSubcategory || null,
          target_sector_id: TI_SECTOR_ID,
          assignee_id: assigneeId,
          // Solicitante escolhido na etapa "para você ou outra pessoa" —
          // não é sempre quem está logado: o problema real que motivou essa
          // pergunta era chamado aberto em nome de outra pessoa saindo sempre
          // parametrizado com quem abriu. Fallback pro próprio usuário só
          // por segurança (nunca deveria faltar depois da etapa "requester").
          requester_id: selectedRequesterId || user.id,
          // Quem de fato submeteu o chamado — só diferente de requester_id
          // quando é "para outra pessoa" (ver comentário na migration
          // 202608262000_ticket_opened_by.sql).
          opened_by_id: user.id,
          status: "new",
          priority: priority as any,
        } as any)
        .select()
        .single();

      if (ticketError) throw ticketError;

      const hasDefaultPriority = !!(subcategories?.find(s => s.id === selectedSubcategory)?.default_priority
        || categories?.find(c => c.id === selectedCategory)?.default_priority);

      if (!hasDefaultPriority) {
        supabase.functions.invoke("classify-priority", {
          body: { title, description, type: "request", category: categoryName, subcategory: subcategoryName },
        }).then(async ({ data: aiResult, error: aiError }) => {
          if (!aiError && aiResult?.priority && aiResult.priority !== "p3") {
            await supabase.from("tickets").update({ priority: aiResult.priority as any }).eq("id", ticket.id);
          }
        }).catch(console.error);
      }

      if (attachedFiles.length > 0) {
        for (const file of attachedFiles) {
          const fileExt = file.name.split(".").pop();
          const filePath = `${ticket.id}/${crypto.randomUUID()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from("ticket-attachments").upload(filePath, file);
          if (uploadError) throw uploadError;
          const { error: attachmentError } = await supabase.from("attachments").insert({
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

      setCreatedCode((ticket as any).ticket_code ?? null);
      say("bot", `Pronto! Seu chamado foi aberto${(ticket as any).ticket_code ? ` com o número #${String((ticket as any).ticket_code).padStart(3, "0")}` : ""}. A TI já foi notificada e você acompanha tudo por aqui.`);
      setStep("done");
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      toast.error("Erro ao criar chamado: " + error.message);
      setStep("attachments");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Abrir chamado <span className="text-primary">TI</span>
        </h2>
        <p className="text-muted-foreground">Responda as perguntas e a TI recebe tudo já classificado.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-primary/25 bg-card shadow-lg shadow-black/20">
        {/* Faixa dourada do topo — mesma linguagem visual do resto do sistema */}
        <div className="flex items-center gap-2.5 border-b border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Headset className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Atendimento TI</p>
            <p className="text-xs text-muted-foreground">Suas respostas classificam o chamado</p>
          </div>
        </div>

        <div ref={scrollRef} className="max-h-[420px] min-h-[280px] space-y-3 overflow-y-auto p-4">
          {history.map((entry, i) => <Bubble key={i} entry={entry} />)}
        </div>

        <div className="border-t border-border bg-muted/20 p-4">
          {step === "category" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {orderedCategories.map(cat => {
                const key = normalizeCategoryName(cat.name);
                const isOutros = key === "outros";
                const realSubs = subcategoryPreviewByCategory[cat.id];
                // Prévia real das subcategorias cadastradas; só cai pro texto
                // genérico (CATEGORY_HINTS) quando a categoria não tem
                // nenhuma — ex.: "Outros" nunca tem subcategoria própria.
                const hint = realSubs?.length ? realSubs.join(", ") : CATEGORY_HINTS[key];
                return (
                  <CategoryChip
                    key={cat.id}
                    label={cat.name}
                    hint={hint}
                    muted={isOutros}
                    onClick={() => pickCategory(cat.id, cat.name)}
                  />
                );
              })}
              {/* Estados separados de propósito: "carregando", "falhou" e
                  "nenhuma categoria cadastrada" são problemas diferentes e
                  precisam de mensagens diferentes pra dar pra diagnosticar. */}
              {catsLoading && <p className="text-sm text-muted-foreground">Carregando opções...</p>}
              {catsError && (
                <p className="text-sm text-destructive">
                  Não foi possível carregar as categorias: {(catsError as Error).message}
                </p>
              )}
              {!catsLoading && !catsError && !categories?.length && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma categoria cadastrada para o setor de TI.
                </p>
              )}
            </div>
          )}

          {step === "subcategory" && (
            <div className="flex flex-wrap gap-2">
              {subcategories?.map(sub => (
                <Chip key={sub.id} label={sub.name} onClick={() => pickSubcategory(sub.id, sub.name)} />
              ))}
            </div>
          )}

          {step === "requester" && (
            <div className="flex flex-wrap gap-2">
              <Chip label="Para mim" onClick={pickRequesterSelf} />
              <Chip label="Para outra pessoa" onClick={pickRequesterOther} />
            </div>
          )}

          {step === "requester_person" && (
            // Dropdown em vez de balões — com dezenas de pessoas cadastradas,
            // uma parede de chips vira bagunça. O Select do Radix já deixa
            // digitar pra pular pro nome, então não precisa de busca própria.
            <Select onValueChange={(id) => {
              const p = (allProfiles ?? []).find(x => x.id === id);
              pickRequesterPerson(id, p?.full_name || "Sem nome");
            }}>
              <SelectTrigger autoFocus className="w-full">
                <SelectValue placeholder="Selecione a pessoa..." />
              </SelectTrigger>
              <SelectContent>
                {(allProfiles ?? []).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
                ))}
                {allProfiles !== undefined && allProfiles.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma pessoa encontrada.</p>
                )}
              </SelectContent>
            </Select>
          )}

          {step === "description" && (
            <div className="space-y-2">
              <Textarea
                autoFocus
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitDescription(); }
                }}
                placeholder="Ex.: não consigo acessar a pasta do Fiscal 2025 no Drive"
                className="min-h-[90px] border-border focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Enter envia · Shift+Enter quebra linha</span>
                <Button onClick={submitDescription} disabled={!description.trim()}>Enviar</Button>
              </div>
            </div>
          )}

          {step === "attachments" && (
            <div className="space-y-3">
              {/* tabIndex torna a div focável: sem foco o browser não entrega
                  o evento de paste, e colar o print não funcionaria. */}
              <div
                tabIndex={0}
                onPaste={handlePaste}
                className="flex cursor-text flex-col items-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-center text-sm text-muted-foreground outline-none transition-colors hover:border-primary/60 focus:border-primary focus:bg-primary/10"
              >
                <Paperclip className="h-4 w-4 text-primary" />
                <span>
                  Clique aqui e cole o print com{" "}
                  <kbd className="rounded border border-primary/30 bg-background px-1.5 py-0.5 text-xs text-primary">Ctrl</kbd>
                  {" + "}
                  <kbd className="rounded border border-primary/30 bg-background px-1.5 py-0.5 text-xs text-primary">V</kbd>
                </span>
              </div>

              <Input
                type="file"
                multiple
                className="cursor-pointer"
                onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
              />

              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachedFiles.map((f, i) => (
                    <div key={`${fileKey(f)}:${i}`} className="relative rounded-lg border border-primary/30 bg-primary/5 p-1">
                      {previews[fileKey(f)] ? (
                        <img src={previews[fileKey(f)]} alt={f.name} className="h-16 w-16 rounded object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded bg-muted px-1 text-center text-[10px] leading-tight text-muted-foreground">
                          {f.name.slice(0, 18)}
                        </div>
                      )}
                      <button
                        onClick={() => removeFile(i)}
                        aria-label={`Remover ${f.name}`}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { say("user", "Sem anexos"); createTicket(); }}>
                  Pular
                </Button>
                <Button onClick={() => {
                  say("user", attachedFiles.length ? `${attachedFiles.length} arquivo(s) anexado(s)` : "Sem anexos");
                  createTicket();
                }}>
                  Abrir chamado
                </Button>
              </div>
            </div>
          )}

          {step === "creating" && (
            <div className="flex items-center justify-center gap-2 py-1 text-sm text-muted-foreground">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              Abrindo seu chamado...
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Chamado registrado
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/portal")}>Voltar ao portal</Button>
                <Button onClick={() => navigate("/portal/my-tickets")}>Ver meus chamados</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PROTÓTIPO / SÓ EM DEV: preview do card real do Kanban (mesmo
          componente, não uma reprodução) com os dados que acabaram de ser
          escolhidos — dá pra ver "Aberto por: X · Para: Y" (ou só o nome,
          se for pra si mesmo) sem precisar de sessão real nem da migration
          de opened_by_id já aplicada. Remover junto com o resto do
          protótipo de dados de exemplo. */}
      {import.meta.env.DEV && step === "done" && (
        <div className="space-y-1.5 rounded-xl border border-dashed border-primary/30 p-3">
          <p className="text-xs text-muted-foreground">Prévia (dev) — como este chamado apareceria no Kanban:</p>
          <div className="max-w-[260px]">
            <KanbanTicketCard
              ticket={{
                ticket_code: 999,
                priority: "p3",
                title: buildTitle(categoryLabel, subcategoryLabel) || "Assunto do chamado",
                opened_by_id: profile?.id || "opener",
                requester_id: selectedRequesterId || profile?.id || "opener",
                opened_by: { full_name: profile?.full_name || firstName || "Você" },
                requester: { full_name: selectedRequesterName || profile?.full_name || firstName || "Você" },
              }}
              columnId="open"
              borderColor=""
              isDragging={false}
              onClick={() => {}}
            />
          </div>

          {/* Mesma linha "Solicitante"/"Aberto por · Para" do modal de
              detalhes (TicketDetailDialog) — não dá pra renderizar o modal
              inteiro aqui porque ele busca o chamado direto do Supabase por
              id, não aceita um objeto injetado como o card do Kanban aceita.
              Reproduz o JSX exato (mesmas classes) só dessa linha. */}
          <p className="pt-2 text-xs text-muted-foreground">E assim no modal de detalhes:</p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            {selectedRequesterId && selectedRequesterId !== profile?.id ? (
              <span>
                Aberto por: <strong className="text-foreground">{profile?.full_name || firstName || "Você"}</strong>
                {" · "}Para: <strong className="text-foreground">{selectedRequesterName || "—"}</strong>
                <button type="button" title="Trocar solicitante (Admin TI)" className="ml-1 align-middle text-muted-foreground hover:text-foreground">
                  <Pencil className="inline h-3 w-3" />
                </button>
              </span>
            ) : (
              <span>
                Solicitante: <strong className="text-foreground">{profile?.full_name || firstName || "Você"}</strong>
                <button type="button" title="Trocar solicitante (Admin TI)" className="ml-1 align-middle text-muted-foreground hover:text-foreground">
                  <Pencil className="inline h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {step !== "done" && step !== "creating" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/portal")}>Cancelar</Button>
            {undoStack.length > 0 && (
              <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5 text-primary hover:text-primary">
                <Undo2 className="h-3.5 w-3.5" />
                Corrigir resposta anterior
              </Button>
            )}
          </div>
          {(step === "description" || step === "attachments") && categoryLabel && (
            <span className="text-xs text-muted-foreground">
              Assunto: <span className="text-foreground">{buildTitle(categoryLabel, subcategoryLabel)}</span>
            </span>
          )}
        </div>
      )}

      {createdCode !== null && (
        <p className="text-center text-xs text-muted-foreground">
          Chamado #{String(createdCode).padStart(3, "0")} criado.
        </p>
      )}
    </div>
  );
};

export default NewTicketChat;
