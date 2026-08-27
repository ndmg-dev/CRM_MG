import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@suporte/components/ui/dialog";
import { PlusCircle, Clock, Monitor, Building2, Search } from "lucide-react";
import { useNavigate } from "@suporte/lib/router-shim";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { useMemo, useState } from "react";
import { ticketCategory } from "@suporte/utils/ticketStatus";

// Tokens — ver frontend/packages/@mg/tokens/build/tokens.css. Handoff:
// Portal do Usuario.dc.html.
const GOLD = "var(--mg-color-gold-base)";
const TEXT_PRIMARY = "var(--mg-color-text-primary)";
const TEXT_SECONDARY = "var(--mg-color-text-secondary)";
const TEXT_MUTED = "var(--mg-color-text-muted)";
const BORDER_DEFAULT = "var(--mg-color-border-default)";
const BG_CARD = "var(--mg-color-bg-card)";
const SUCCESS = "var(--mg-color-status-success)";

const CARD_CLASS = "bg-[var(--mg-color-bg-card)] border border-[var(--mg-color-border-default)] rounded-xl";

/** Aberto=dourado, Em Andamento=verde (inclui testing/parado — ainda ativo
 * do ponto de vista de quem abriu o chamado), Fechado=cinza. Mesma fonte de
 * verdade (ticketCategory) usada no Kanban/chat, só reagrupada em 3 baldes
 * pra bater com o resumo simplificado desta tela. */
function statusPillStyle(status: string | null) {
  const cat = ticketCategory(status);
  if (cat === "todo") return { label: "Aberto", color: GOLD, bg: "rgba(210,170,63,0.10)", border: "rgba(210,170,63,0.28)" };
  if (cat === "closed") return { label: "Fechado", color: TEXT_SECONDARY, bg: "var(--mg-color-bg-hover)", border: BORDER_DEFAULT };
  return { label: "Em Andamento", color: SUCCESS, bg: "rgba(85,217,165,0.10)", border: "rgba(85,217,165,0.28)" };
}

const Portal = () => {
  const navigate = useNavigate();
  const [showTicketChoice, setShowTicketChoice] = useState(false);
  const [search, setSearch] = useState("");

  const { data: recentTickets, isLoading } = useQuery({
    queryKey: ["recent-tickets"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("requester_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return (recentTickets ?? []).slice(0, 5);
    return (recentTickets ?? []).filter(
      (t) => t.title?.toLowerCase().includes(term) || String(t.ticket_code).padStart(3, "0").includes(term)
    );
  }, [recentTickets, search]);

  // 3 contadores (Abertos / Em andamento / Fechados) em vez de um número
  // solto com espaço vazio ao lado — handoff: Portal do Usuario.dc.html.
  const { data: myTicketStatuses } = useQuery({
    queryKey: ["my-tickets-status-summary"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("tickets")
        .select("status")
        .eq("requester_id", user.id)
        .is("archived_at", null);
      if (error) throw error;
      return data;
    },
  });

  const statusCounts = useMemo(() => {
    const counts = { open: 0, in_progress: 0, closed: 0 };
    (myTicketStatuses ?? []).forEach((t) => {
      const cat = ticketCategory(t.status);
      if (cat === "todo") counts.open++;
      else if (cat === "closed") counts.closed++;
      else counts.in_progress++;
    });
    return counts;
  }, [myTicketStatuses]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
        <div
          className={CARD_CLASS}
          style={{ padding: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
          onClick={() => setShowTicketChoice(true)}
        >
          <div>
            <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>Abrir Chamado</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>Novo chamado</div>
            <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>Relatar problema ou solicitar serviço</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(210,170,63,0.14)", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <PlusCircle className="h-5 w-5" />
          </div>
        </div>

        <Dialog open={showTicketChoice} onOpenChange={setShowTicketChoice}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Qual tipo de chamado deseja abrir?</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <button
                type="button"
                className="flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent/10 border-primary/20"
                onClick={() => { setShowTicketChoice(false); navigate("/portal/new-ticket-ti"); }}
              >
                <Monitor className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-semibold">Chamado TI</p>
                  <p className="text-xs text-muted-foreground">Problemas técnicos, sistemas, equipamentos</p>
                </div>
              </button>
              <button
                type="button"
                className="flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent/10 border-primary/20"
                onClick={() => { setShowTicketChoice(false); navigate("/portal/new-ticket"); }}
              >
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-semibold">Chamado Interno</p>
                  <p className="text-xs text-muted-foreground">Solicitações entre setores da empresa</p>
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <div className={CARD_CLASS} style={{ padding: 22, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>Meus Chamados</span>
            <Clock className="h-4 w-4" style={{ color: GOLD }} />
          </div>
          <div className="flex" style={{ gap: 18 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{statusCounts.open}</div>
              <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Abertos</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: SUCCESS }}>{statusCounts.in_progress}</div>
              <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Em andamento</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: TEXT_SECONDARY }}>{statusCounts.closed}</div>
              <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Fechados</div>
            </div>
          </div>
        </div>
      </div>

      <div className={CARD_CLASS} style={{ overflow: "hidden" }}>
        <div className="flex items-center justify-between flex-wrap" style={{ padding: "18px 20px", borderBottom: `0.5px solid ${BORDER_DEFAULT}`, gap: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}>Chamados Recentes</span>
          <div className="flex items-center" style={{ gap: 6, background: "var(--mg-color-bg-surface)", border: `0.5px solid ${BORDER_DEFAULT}`, borderRadius: 8, padding: "0 10px", height: 34, minWidth: 220 }}>
            <Search className="h-3.5 w-3.5" style={{ color: TEXT_MUTED }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número ou título..."
              style={{ border: "none", background: "transparent", color: TEXT_PRIMARY, fontSize: 12.5, outline: "none", flex: 1, fontFamily: "inherit" }}
            />
          </div>
        </div>

        <div>
          {isLoading ? (
            <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "24px 0" }}>Carregando...</p>
          ) : filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => {
              const pill = statusPillStyle(ticket.status);
              return (
                <div
                  key={ticket.id}
                  className="flex items-center hover:bg-[var(--mg-color-bg-hover)]"
                  style={{ gap: 14, padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", cursor: "default" }}
                >
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700, color: GOLD, background: "rgba(210,170,63,0.12)", border: "0.5px solid rgba(210,170,63,0.3)", padding: "3px 7px", borderRadius: 5, flexShrink: 0 }}>
                    #{String(ticket.ticket_code).padStart(3, "0")}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket.title}</div>
                    <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginTop: 2 }}>
                      {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: pill.color, background: pill.bg, border: `0.5px solid ${pill.border}`, padding: "4px 10px", borderRadius: 999, flexShrink: 0 }}>
                    {pill.label}
                  </span>
                </div>
              );
            })
          ) : (
            <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "24px 0" }}>
              {search.trim() ? "Nenhum chamado encontrado." : "Nenhum chamado recente."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Portal;
