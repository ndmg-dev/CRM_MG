import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { format } from "date-fns";
import { useUserSector } from "@suporte/hooks/useUserSector";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Search, X } from "lucide-react";
import { Calendar } from "@suporte/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@suporte/components/ui/popover";
import { Select } from "@mg/ui";
import { TicketDetailDialog } from "@suporte/components/admin/TicketDetailDialog";

// Tokens — ver frontend/packages/@mg/tokens/build/tokens.css. Handoff:
// Gestao Consulta de Chamados.dc.html.
const GOLD = "var(--mg-color-gold-base)";
const TEXT_PRIMARY = "var(--mg-color-text-primary)";
const TEXT_SECONDARY = "var(--mg-color-text-secondary)";
const TEXT_MUTED = "var(--mg-color-text-muted)";
const BORDER_DEFAULT = "var(--mg-color-border-default)";
const BG_CARD = "var(--mg-color-bg-card)";
const SUCCESS = "var(--mg-color-status-success)";
const WARNING = "var(--mg-color-status-warning)";
const ERROR = "var(--mg-color-status-error)";
const INFO = "var(--mg-color-status-info)";

const CARD_CLASS = "bg-[var(--mg-color-bg-card)] border border-[var(--mg-color-border-default)] rounded-xl";
const DATE_TRIGGER_CLASS =
  "flex items-center gap-2 h-[38px] px-3 rounded-lg text-[13px] bg-[var(--mg-color-bg-hover)] border border-[var(--mg-color-border-default)] text-[var(--mg-color-text-secondary)] hover:border-[var(--mg-color-border-strong)] transition-colors w-full";

// Mesmo mapeamento canônico usado no Kanban/TicketDetailDialog/MyTickets:
// new/open = "A Fazer", pending = "Em Andamento".
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
const statusStyle: Record<string, { color: string; bg: string }> = {
  new: { color: INFO, bg: "rgba(92,148,239,0.12)" },
  open: { color: INFO, bg: "rgba(92,148,239,0.12)" },
  pending: { color: WARNING, bg: "rgba(216,174,66,0.12)" },
  parado: { color: TEXT_SECONDARY, bg: "var(--mg-color-bg-hover)" },
  testing: { color: INFO, bg: "rgba(92,148,239,0.12)" },
  resolved: { color: SUCCESS, bg: "rgba(85,217,165,0.12)" },
  closed: { color: SUCCESS, bg: "rgba(85,217,165,0.12)" },
  canceled: { color: TEXT_SECONDARY, bg: "var(--mg-color-bg-hover)" },
};

const priorityLabels: Record<string, string> = {
  p0: "P0 - Crítica",
  p1: "P1 - Alta",
  p2: "P2 - Média",
  p3: "P3 - Baixa",
};
const priorityStyle: Record<string, { color: string; bg: string }> = {
  p0: { color: ERROR, bg: "rgba(239,102,102,0.10)" },
  p1: { color: ERROR, bg: "rgba(239,102,102,0.10)" },
  p2: { color: WARNING, bg: "rgba(216,174,66,0.10)" },
  p3: { color: TEXT_SECONDARY, bg: "var(--mg-color-bg-hover)" },
};

const TicketConsultation = () => {
  const sector = useUserSector();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [categoryId, setCategoryId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: staffProfiles } = useQuery({
    queryKey: ["staff-profiles-consultation"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["support_agent", "dev", "admin_ti", "coordinator"]);
      if (rolesError) throw rolesError;
      if (!roles?.length) return [];
      const uniqueIds = [...new Set(roles.map(r => r.user_id))];
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", uniqueIds);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["consultation-tickets", sector.sectorId, showArchived],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select(`
          *,
          assignee:profiles!assignee_id(full_name, email),
          requester:profiles!requester_id(full_name, email),
          category:categories!category_id(name)
        `)
        .order("created_at", { ascending: false });

      query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

      const isCoordinatorTI = sector.roles.includes("coordinator");
      const isAdminTI = sector.roles.includes("admin_ti");
      if (!sector.isDirection && !isCoordinatorTI && !isAdminTI) {
        if (sector.sectorId) {
          query = query.eq("target_sector_id", sector.sectorId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: sector.roles.length > 0 && (sector.isDirection || sector.roles.includes("coordinator") || sector.roles.includes("admin_ti") || !!sector.sectorId),
  });

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((t) => {
      if (dateFrom) {
        const created = new Date(t.created_at!);
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (created < from) return false;
      }
      if (dateTo) {
        const created = new Date(t.created_at!);
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (created > to) return false;
      }
      if (categoryId && t.category_id !== categoryId) return false;
      if (assigneeId) {
        if (assigneeId === "unassigned") {
          if (t.assignee_id) return false;
        } else if (t.assignee_id !== assigneeId) return false;
      }
      if (searchText) {
        const s = searchText.toLowerCase();
        const code = String(t.ticket_code).padStart(3, "0");
        const requesterName = (t.requester as any)?.full_name || (t.requester as any)?.email || "";
        const assigneeName = (t.assignee as any)?.full_name || (t.assignee as any)?.email || "";
        if (
          !t.title.toLowerCase().includes(s) &&
          !code.includes(s) &&
          !requesterName.toLowerCase().includes(s) &&
          !assigneeName.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [tickets, dateFrom, dateTo, categoryId, assigneeId, searchText]);

  const hasFilters = dateFrom || dateTo || categoryId || assigneeId || searchText;

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setCategoryId("");
    setAssigneeId("");
    setSearchText("");
  };

  const canSeeArchivedToggle = sector.isDirection || sector.roles.includes("admin_ti");

  return (
    <div className="space-y-5">
      <div>
        <h1 style={{ color: TEXT_PRIMARY, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Consulta de Chamados</h1>
        <p style={{ color: TEXT_SECONDARY, fontSize: 13, margin: 0 }}>Pesquise e filtre chamados por data, categoria ou usuário</p>
      </div>

      <div className={CARD_CLASS} style={{ padding: 18 }}>
        <div className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 16 }}>
          <Search className="h-3.5 w-3.5" style={{ color: GOLD }} />
          Filtros
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr" }}>
          <div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginBottom: 6 }}>Buscar</div>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Código, título ou usuário..."
              style={{ width: "100%", height: 38, padding: "0 12px", background: BG_CARD, border: `0.5px solid ${BORDER_DEFAULT}`, borderRadius: 8, color: TEXT_PRIMARY, fontSize: 13, fontFamily: "inherit", outline: "none" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginBottom: 6 }}>Data inicial</div>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={DATE_TRIGGER_CLASS}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginBottom: 6 }}>Data final</div>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={DATE_TRIGGER_CLASS}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} className="p-3 pointer-events-auto" disabled={(date) => dateFrom ? date < dateFrom : false} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginBottom: 6 }}>Categoria</div>
            <Select
              options={[{ value: "all", label: "Todas categorias" }, ...((categories ?? []).map((c) => ({ value: c.id, label: c.name })))]}
              value={categoryId || "all"}
              onValueChange={(v) => setCategoryId(v === "all" ? "" : v)}
              aria-label="Filtrar por categoria"
            />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginBottom: 6 }}>Responsável</div>
            <Select
              options={[
                { value: "all", label: "Todos responsáveis" },
                { value: "unassigned", label: "Sem responsável" },
                ...((staffProfiles ?? []).map((p) => ({ value: p.id, label: p.full_name || p.email || "" }))),
              ]}
              value={assigneeId || "all"}
              onValueChange={(v) => setAssigneeId(v === "all" ? "" : v)}
              aria-label="Filtrar por responsável"
            />
          </div>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1.5"
            style={{ marginTop: 12, background: "none", border: "none", color: TEXT_MUTED, fontSize: 13, cursor: "pointer", padding: 0 }}
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
      </div>

      {canSeeArchivedToggle && (
        <div className="flex items-center gap-3">
          <span
            onClick={() => { setShowArchived((v) => !v); setSelectedTicketId(null); }}
            style={{ width: 38, height: 22, borderRadius: 999, background: showArchived ? GOLD : BORDER_DEFAULT, position: "relative", cursor: "pointer", transition: "background 150ms ease" }}
          >
            <span style={{ position: "absolute", top: 2, left: showArchived ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: TEXT_PRIMARY, transition: "left 150ms ease" }} />
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_PRIMARY }}>Consultar chamados arquivados</span>
        </div>
      )}
      <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>{filteredTickets.length} chamados encontrados</div>

      <div className={CARD_CLASS} style={{ overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ fontSize: 13, color: TEXT_MUTED, padding: 24 }}>Carregando chamados...</p>
        ) : filteredTickets.length === 0 ? (
          <p style={{ fontSize: 13, color: TEXT_MUTED, padding: 24, textAlign: "center" }}>Nenhum chamado encontrado com os filtros selecionados.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div className="min-w-[900px]">
              <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 140px 140px 130px 120px 120px 140px", padding: "12px 18px", fontSize: 12, color: TEXT_SECONDARY, borderBottom: `0.5px solid ${BORDER_DEFAULT}` }}>
                <div>Código</div><div>Título</div><div>Solicitante</div><div>Responsável</div><div>Categoria</div><div>Prioridade</div><div>Status</div><div>Data</div>
              </div>
              {filteredTickets.map((ticket) => {
                const pr = priorityStyle[ticket.priority || "p3"];
                const st = statusStyle[ticket.status || "new"];
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className="hover:bg-[var(--mg-color-bg-hover)] cursor-pointer"
                    style={{ display: "grid", gridTemplateColumns: "70px 1fr 140px 140px 130px 120px 120px 140px", alignItems: "center", padding: "13px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}
                  >
                    <div style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: "ui-monospace, monospace" }}>#{String(ticket.ticket_code).padStart(3, "0")}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{ticket.title}</div>
                    <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>{(ticket.requester as any)?.full_name || (ticket.requester as any)?.email || "—"}</div>
                    <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>{(ticket.assignee as any)?.full_name || (ticket.assignee as any)?.email || "—"}</div>
                    <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>{(ticket.category as any)?.name || "—"}</div>
                    <div>
                      <span style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px", background: pr.bg, color: pr.color, fontSize: 10.5, fontWeight: 700, borderRadius: 999, whiteSpace: "nowrap" }}>
                        {priorityLabels[ticket.priority || "p3"]}
                      </span>
                    </div>
                    <div>
                      <span style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 9px", background: st.bg, color: st.color, fontSize: 10.5, fontWeight: 700, borderRadius: 999, whiteSpace: "nowrap" }}>
                        {statusLabels[ticket.status || "new"]}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: TEXT_MUTED, whiteSpace: "nowrap" }}>{format(new Date(ticket.created_at!), "dd/MM/yyyy HH:mm")}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <TicketDetailDialog
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
        readOnly={showArchived}
        archivedMode={showArchived}
      />
    </div>
  );
};

export default TicketConsultation;
