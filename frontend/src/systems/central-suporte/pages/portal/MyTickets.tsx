import { useState } from "react";
import { PlusCircle, Clock, Eye, Search } from "lucide-react";
import { useNavigate } from "@suporte/lib/router-shim";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { TicketDetailDialog } from "@suporte/components/admin/TicketDetailDialog";

// Tokens — ver frontend/packages/@mg/tokens/build/tokens.css. Handoff:
// Meus Chamados.dc.html.
const GOLD = "var(--mg-color-gold-base)";
const TEXT_PRIMARY = "var(--mg-color-text-primary)";
const TEXT_SECONDARY = "var(--mg-color-text-secondary)";
const TEXT_MUTED = "var(--mg-color-text-muted)";
const BORDER_DEFAULT = "var(--mg-color-border-default)";
const INFO = "var(--mg-color-status-info)";
const SUCCESS = "var(--mg-color-status-success)";
const ERROR = "var(--mg-color-status-error)";
const WARNING = "var(--mg-color-status-warning)";

const CARD_CLASS = "bg-[var(--mg-color-bg-card)] border border-[var(--mg-color-border-default)] rounded-xl";

// Mesmo mapeamento canônico usado no Kanban/TicketDetailDialog: new/open =
// "A Fazer", pending = "Em Andamento" — NÃO reintroduzir a versão antiga
// (que tinha "open" como "Em Andamento") sem checar o Kanban antes.
const statusLabels: Record<string, string> = {
  new: "A Fazer",
  open: "A Fazer",
  pending: "Em Andamento",
  parado: "Parado",
  testing: "Em Teste",
  resolved: "Concluído",
  closed: "Concluído",
  canceled: "Cancelado",
};

const priorityLabels: Record<string, string> = { p0: "Crítica", p1: "Alta", p2: "Média", p3: "Baixa" };
const priorityStyle: Record<string, { color: string; bg: string }> = {
  p0: { color: ERROR, bg: "rgba(239,102,102,0.10)" },
  p1: { color: ERROR, bg: "rgba(239,102,102,0.10)" },
  p2: { color: WARNING, bg: "rgba(216,174,66,0.10)" },
  p3: { color: SUCCESS, bg: "rgba(85,217,165,0.10)" },
};

const MyTickets = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          category:categories!category_id(name),
          subcategory:subcategories!subcategory_id(name)
        `)
        .eq("requester_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (tickets ?? []).filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || String(t.ticket_code).includes(q);
  });

  const counts = {
    total: tickets?.length || 0,
    open: tickets?.filter((t) => t.status === "open" || t.status === "new").length || 0,
    pending: tickets?.filter((t) => t.status === "pending").length || 0,
    resolved: tickets?.filter((t) => t.status === "resolved" || t.status === "closed").length || 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ color: TEXT_PRIMARY, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Meus Chamados</h1>
          <p style={{ color: TEXT_SECONDARY, fontSize: 13, margin: 0 }}>Acompanhe todas as suas solicitações</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/portal/new-ticket")}
          className="flex items-center gap-2"
          style={{ height: 40, padding: "0 18px", background: GOLD, color: "var(--mg-color-bg-base)", border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
        >
          <PlusCircle className="h-4 w-4" /> Chamado Interno
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className={CARD_CLASS} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginBottom: 8 }}>Total</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: TEXT_PRIMARY }}>{counts.total}</div>
        </div>
        <div className={CARD_CLASS} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginBottom: 8 }}>Abertos</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: INFO }}>{counts.open}</div>
        </div>
        <div className={CARD_CLASS} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginBottom: 8 }}>Aguardando</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: GOLD }}>{counts.pending}</div>
        </div>
        <div className={CARD_CLASS} style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginBottom: 8 }}>Concluídos</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: SUCCESS }}>{counts.resolved}</div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2" style={{ flex: 1, maxWidth: 340, height: 38, padding: "0 12px", background: "var(--mg-color-bg-card)", border: `0.5px solid ${BORDER_DEFAULT}`, borderRadius: 8 }}>
          <Search className="h-3.5 w-3.5" style={{ color: TEXT_MUTED }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou código..."
            style={{ border: "none", background: "transparent", color: TEXT_PRIMARY, fontSize: 13, outline: "none", flex: 1, fontFamily: "inherit" }}
          />
        </div>
      </div>

      <div className={CARD_CLASS} style={{ overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ fontSize: 13, color: TEXT_MUTED, padding: 24 }}>Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ padding: "48px 0", color: TEXT_MUTED }}>
            <Clock className="h-8 w-8 mb-3" style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 13 }}>Nenhum chamado encontrado</p>
          </div>
        ) : (
          <>
            <div className="hidden md:grid" style={{ gridTemplateColumns: "90px 1fr 140px 110px 100px 110px 40px", padding: "12px 18px", fontSize: 12, color: TEXT_SECONDARY, borderBottom: `0.5px solid ${BORDER_DEFAULT}` }}>
              <div>Código</div><div>Título</div><div>Categoria</div><div>Status</div><div>Prioridade</div><div>Data</div><div />
            </div>
            {filtered.map((ticket) => {
              const pr = priorityStyle[ticket.priority || "p3"];
              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className="grid grid-cols-1 md:grid-cols-[90px_1fr_140px_110px_100px_110px_40px] items-center hover:bg-[var(--mg-color-bg-hover)] cursor-pointer gap-1 md:gap-0"
                  style={{ padding: "14px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}
                >
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", background: "rgba(210,170,63,0.14)", color: GOLD, fontSize: 11.5, fontWeight: 700, borderRadius: 999 }}>
                      {String(ticket.ticket_code).padStart(3, "0")}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{ticket.title}</div>
                  <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>{ticket.category?.name || "—"}</div>
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", height: 21, padding: "0 9px", background: "var(--mg-color-bg-hover)", color: TEXT_PRIMARY, fontSize: 11, fontWeight: 600, borderRadius: 999, whiteSpace: "nowrap" }}>
                      {statusLabels[ticket.status || "new"]}
                    </span>
                  </div>
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", height: 21, padding: "0 9px", background: pr.bg, color: pr.color, fontSize: 11, fontWeight: 700, borderRadius: 999, whiteSpace: "nowrap" }}>
                      {priorityLabels[ticket.priority || "p3"]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>{new Date(ticket.created_at!).toLocaleDateString("pt-BR")}</div>
                  <div style={{ color: TEXT_MUTED }}><Eye className="h-4 w-4" /></div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <TicketDetailDialog
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
        readOnly
      />
    </div>
  );
};

export default MyTickets;
