import { Select, Badge, Avatar } from "@mg/ui";
import { BarChart3, TrendingUp, Clock, CheckCircle2, AlertTriangle, Users, Timer, CalendarIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { useMemo, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from "recharts";
import { format, subDays, addDays, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserSector } from "@suporte/hooks/useUserSector";
import { Calendar } from "@suporte/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@suporte/components/ui/popover";
import { cn } from "@suporte/lib/utils";

// Tokens de @mg/tokens (frontend/packages/@mg/tokens/build/tokens.css,
// importado globalmente em main.tsx) — nunca hardcodar hex aqui, sempre
// referenciar a variável CSS pra acompanhar o design system automaticamente.
const GOLD = "var(--mg-color-gold-base)";
const SUCCESS = "var(--mg-color-status-success)";
const WARNING = "var(--mg-color-status-warning)";
const ERROR = "var(--mg-color-status-error)";
const INFO = "var(--mg-color-status-info)";
const ACCENT_PURPLE = "var(--mg-color-accent-purple)";
const ACCENT_CYAN = "var(--mg-color-accent-cyan)";
const ACCENT_PINK = "var(--mg-color-accent-pink)";
const TEXT_PRIMARY = "var(--mg-color-text-primary)";
const TEXT_MUTED = "var(--mg-color-text-muted)";
const BORDER_DEFAULT = "var(--mg-color-border-default)";
const BG_CARD = "var(--mg-color-bg-card)";

// Cor por status do chamado no donut — os 3 status do handoff original
// (Fechado=dourado, Parado=success, Pendente=info) mais os demais valores
// possíveis que a tabela real pode ter e o protótipo não previa.
const STATUS_COLORS: Record<string, string> = {
  resolved: GOLD,
  closed: GOLD,
  parado: SUCCESS,
  pending: INFO,
  new: ACCENT_PURPLE,
  open: ACCENT_PURPLE,
  testing: ACCENT_CYAN,
  canceled: ACCENT_PINK,
};

const CARD_CLASS = "bg-[var(--mg-color-bg-card)] border border-[var(--mg-color-border-default)] rounded-xl";
const DATE_TRIGGER_CLASS =
  "flex items-center gap-2 h-9 px-3.5 rounded-[10px] text-[13px] bg-[var(--mg-color-bg-surface)] border border-[var(--mg-color-border-default)] text-[var(--mg-color-text-secondary)] hover:border-[var(--mg-color-border-strong)] transition-colors";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const Reports = () => {
  const [period, setPeriod] = useState("30");
  const [selectedSector, setSelectedSector] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const sector = useUserSector();

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Determine the effective sector filter
  const effectiveSectorId = useMemo(() => {
    // Admin TI, coordinators, and viewers: locked to their sector
    if (!sector.isDirection) {
      return sector.visibleSectorId;
    }
    // Direction: use dropdown selection
    return selectedSector === "all" ? null : selectedSector;
  }, [sector, selectedSector]);

  const canFilterSector = sector.isDirection;

  const sectorOptions = useMemo(
    () => [{ value: "all", label: "Todos os setores" }, ...((sectors ?? []).map((s) => ({ value: s.id, label: s.name })))],
    [sectors]
  );

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["report-tickets", effectiveSectorId],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select(`*, category:categories(name), assignee:profiles!assignee_id(full_name, foto_url)`)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (effectiveSectorId) {
        query = query.eq("target_sector_id", effectiveSectorId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: sector.roles.length > 0,
  });

  const { data: incidents } = useQuery({
    queryKey: ["report-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incidents").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Mesmo critério usado pelos chamados e pelos incidentes (abaixo) — extraído
  // pra função só, em vez de repetir a lógica de data em cada filtro.
  const isInSelectedPeriod = useMemo(() => {
    return (dateStr: string | null) => {
      if (!dateStr) return false;
      const created = new Date(dateStr);
      // Se datas customizadas estão definidas, usa elas; senão, o dropdown de período
      if (dateFrom || dateTo) {
        if (dateFrom && isBefore(created, startOfDay(dateFrom))) return false;
        if (dateTo && isAfter(created, endOfDay(dateTo))) return false;
        return true;
      }
      const cutoff = subDays(new Date(), parseInt(period));
      return isAfter(created, cutoff);
    };
  }, [period, dateFrom, dateTo]);

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((t) => isInSelectedPeriod(t.created_at));
  }, [tickets, isInSelectedPeriod]);

  const filteredIncidents = useMemo(() => {
    if (!incidents) return [];
    // Nota: "incidents" não tem coluna de setor, então só dá pra aplicar o
    // filtro de período aqui — o filtro de setor (quando Direção seleciona
    // um setor específico) não tem como ser replicado nesta tabela.
    return incidents.filter((i) => isInSelectedPeriod(i.created_at));
  }, [incidents, isInSelectedPeriod]);

  // Calculado somente sobre chamados ativos/não arquivados carregados acima.
  const metrics = useMemo(() => {
    const responseHours = filteredTickets
      .filter((ticket) => ticket.created_at && ticket.responded_at && ticket.status !== "parado")
      .map((ticket) => (new Date(ticket.responded_at!).getTime() - new Date(ticket.created_at!).getTime()) / 3_600_000);
    const resolutionHours = filteredTickets
      .filter((ticket) => ticket.created_at && ["resolved", "closed"].includes(ticket.status || ""))
      // resolved_at é gravado por trigger no momento da resolução; updated_at
      // permanece como fallback para chamados resolvidos antes da migração.
      .map((ticket) => {
        const resolvedAt = ticket.resolved_at ?? ticket.updated_at
        return resolvedAt
          ? (new Date(resolvedAt).getTime() - new Date(ticket.created_at!).getTime()) / 3_600_000
          : null
      })
      .filter((hours): hours is number => hours !== null && hours >= 0);
    const average = (values: number[]) => values.length
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
      : null;
    return {
      avg_response_hours: average(responseHours),
      avg_resolution_hours: average(resolutionHours),
    };
  }, [filteredTickets]);

  // Count overdue tickets based on due_date only
  const overdueCount = useMemo(() => {
    const now = new Date();
    return filteredTickets.filter(
      (t) =>
        t.due_date &&
        new Date(t.due_date) < now &&
        !["resolved", "closed", "canceled", "parado"].includes(t.status || "")
    ).length;
  }, [filteredTickets]);

  const stats = useMemo(() => {
    const total = filteredTickets.length;
    const resolved = filteredTickets.filter((t) => ["resolved", "closed"].includes(t.status || "")).length;
    const open = filteredTickets.filter((t) => ["new", "open", "pending"].includes(t.status || "")).length;
    return { total, resolved, open };
  }, [filteredTickets]);

  // Status distribution for donut chart
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    const labels: Record<string, string> = {
      new: "Novo", open: "Aberto", pending: "Pendente", parado: "Parado", testing: "Em Teste",
      resolved: "Resolvido", closed: "Fechado", canceled: "Cancelado",
    };
    filteredTickets.forEach((t) => {
      const s = t.status || "new";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([key, value]) => ({ key, name: labels[key] || key, value, color: STATUS_COLORS[key] || TEXT_MUTED }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTickets]);

  const statusTotal = statusData.reduce((sum, s) => sum + s.value, 0);

  // Category distribution for bar chart
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTickets.forEach((t) => {
      const name = t.category?.name || "Sem categoria";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredTickets]);

  // Daily volume for area chart — os "baldes" de dias precisam cobrir o
  // MESMO intervalo usado pra filtrar os chamados (dateFrom/dateTo, se
  // definidos; senão o dropdown de período). Antes, o gráfico sempre usava
  // o dropdown de período pra montar os dias, mesmo com uma data customizada
  // mais antiga selecionada — chamados fora dessa janela de "período"
  // simplesmente desapareciam do gráfico sem erro nenhum.
  const dailyData = useMemo(() => {
    const end = dateTo ? endOfDay(dateTo) : endOfDay(new Date());
    const start = dateFrom
      ? startOfDay(dateFrom)
      : startOfDay(subDays(dateTo ?? new Date(), parseInt(period)));

    // Trava um intervalo absurdamente grande (ex.: só "Data fim" escolhida,
    // sem início) de virar centenas de pontos ilegíveis no gráfico.
    const MAX_BUCKETS = 366;
    const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const boundedStart = spanDays > MAX_BUCKETS ? subDays(end, MAX_BUCKETS - 1) : start;

    // Rótulo "dd/MM" colide entre anos diferentes (15/03/2025 e 15/03/2026
    // viravam o mesmo ponto, somando as contagens) — inclui o ano só quando
    // o intervalo realmente cruza um ano, pra não poluir o eixo à toa.
    const showYear = end.getFullYear() !== boundedStart.getFullYear();
    const labelFormat = showYear ? "dd/MM/yy" : "dd/MM";

    const buckets = new Map<string, { label: string; count: number }>();
    for (let d = boundedStart; d <= end; d = addDays(d, 1)) {
      buckets.set(format(d, "yyyy-MM-dd"), { label: format(d, labelFormat), count: 0 });
    }
    filteredTickets.forEach((t) => {
      if (!t.created_at) return;
      const bucket = buckets.get(format(new Date(t.created_at), "yyyy-MM-dd"));
      if (bucket) bucket.count++;
    });
    return Array.from(buckets.values()).map((b) => ({ date: b.label, chamados: b.count }));
  }, [filteredTickets, period, dateFrom, dateTo]);

  // Top agents
  const agentData = useMemo(() => {
    const counts: Record<string, { name: string; photo: string | null; resolved: number; total: number }> = {};
    filteredTickets.forEach((t) => {
      if (t.assignee_id) {
        const name = t.assignee?.full_name || "Sem nome";
        const photo = t.assignee?.foto_url || null;
        if (!counts[t.assignee_id]) counts[t.assignee_id] = { name, photo, resolved: 0, total: 0 };
        counts[t.assignee_id].total++;
        if (["resolved", "closed"].includes(t.status || "")) counts[t.assignee_id].resolved++;
      }
    });
    return Object.values(counts).sort((a, b) => b.resolved - a.resolved).slice(0, 5);
  }, [filteredTickets]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: TEXT_MUTED }}>Carregando relatórios...</p>
      </div>
    );
  }

  const kpis: { label: string; value: string | number; color: string; icon: React.ReactNode }[] = [
    { label: "Total", value: stats.total, color: TEXT_PRIMARY, icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { label: "Em Aberto", value: stats.open, color: WARNING, icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { label: "Resolvidos", value: stats.resolved, color: SUCCESS, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { label: "TM Resposta", value: metrics?.avg_response_hours ? `${metrics.avg_response_hours}h` : "—", color: INFO, icon: <Timer className="h-3.5 w-3.5" /> },
    { label: "TM Resolução", value: metrics?.avg_resolution_hours ? `${metrics.avg_resolution_hours}h` : "—", color: TEXT_PRIMARY, icon: <Clock className="h-3.5 w-3.5" /> },
    { label: "Atrasados", value: overdueCount, color: overdueCount > 0 ? ERROR : TEXT_MUTED, icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ];

  return (
    <div style={{ fontFamily: "var(--mg-font-family-base)" }} className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-5">
        <div>
          <h1 style={{ color: TEXT_PRIMARY, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Relatórios</h1>
          <p style={{ color: TEXT_MUTED, fontSize: 14, margin: "6px 0 0" }}>
            Métricas e indicadores de desempenho
            {!canFilterSector && sector.sectorName && <span> — {sector.sectorName}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {canFilterSector && (
            <Select
              options={sectorOptions}
              value={selectedSector}
              onValueChange={setSelectedSector}
              aria-label="Filtrar por setor"
            />
          )}
          <Select
            options={PERIOD_OPTIONS}
            value={period}
            onValueChange={(v) => { setPeriod(v); setDateFrom(undefined); setDateTo(undefined); }}
            aria-label="Filtrar por período"
          />
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={cn(DATE_TRIGGER_CLASS, !dateFrom && "opacity-80")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => setDateFrom(d)} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={cn(DATE_TRIGGER_CLASS, !dateTo && "opacity-80")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => setDateTo(d)} locale={ptBR} initialFocus className="p-3 pointer-events-auto" disabled={(date) => dateFrom ? isBefore(date, dateFrom) : false} />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
              style={{ color: TEXT_MUTED, fontSize: 13 }}
              className="hover:underline"
            >
              Limpar datas
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {kpis.map((k) => (
          <div key={k.label} className={CARD_CLASS} style={{ padding: 18, minWidth: 0 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, color: TEXT_MUTED, fontWeight: 500 }}>{k.label}</span>
              <span style={{ color: k.color, display: "flex" }}>{k.icon}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color, letterSpacing: "-0.01em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        {/* Daily Volume */}
        <div className={CARD_CLASS} style={{ padding: 22 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 18 }}>
            <TrendingUp className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span style={{ fontSize: 14.5, fontWeight: 600, color: TEXT_PRIMARY }}>Volume Diário</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="dailyVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" fontSize={10.5} stroke={TEXT_MUTED} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis fontSize={10.5} stroke={TEXT_MUTED} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{ backgroundColor: BG_CARD, border: `0.5px solid ${BORDER_DEFAULT}`, borderRadius: 8, fontSize: 12.5 }}
                labelStyle={{ color: TEXT_PRIMARY }}
              />
              <Area type="monotone" dataKey="chamados" stroke={GOLD} strokeWidth={2.2} fill="url(#dailyVolumeGradient)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className={CARD_CLASS} style={{ padding: 22, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 18, color: TEXT_PRIMARY }}>Distribuição por Status</div>
          {statusData.length > 0 ? (
            <div className="flex items-center gap-7 flex-1">
              <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={52} outerRadius={75} dataKey="value" stroke="none">
                      {statusData.map((s) => (
                        <Cell key={s.key} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: BG_CARD, border: `0.5px solid ${BORDER_DEFAULT}`, borderRadius: 8, fontSize: 12.5 }}
                      labelStyle={{ color: TEXT_PRIMARY }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
                >
                  <span style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY }}>{statusTotal}</span>
                  <span style={{ fontSize: 10.5, color: TEXT_MUTED }}>total</span>
                </div>
              </div>
              <div className="flex flex-col gap-3.5 flex-1">
                {statusData.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, color: TEXT_PRIMARY }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_PRIMARY }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[250px]" style={{ color: TEXT_MUTED }}>
              Sem dados no período
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        {/* Category Distribution */}
        <div className={CARD_CLASS} style={{ padding: 22 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 18, color: TEXT_PRIMARY }}>Chamados por Categoria</div>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" fontSize={10.5} stroke={TEXT_MUTED} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={40} />
                <YAxis fontSize={10.5} stroke={TEXT_MUTED} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={{ backgroundColor: BG_CARD, border: `0.5px solid ${BORDER_DEFAULT}`, borderRadius: 8, fontSize: 12.5 }}
                  labelStyle={{ color: TEXT_PRIMARY }}
                  cursor={{ fill: "var(--mg-color-bg-hover)" }}
                />
                <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" fill={TEXT_MUTED} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px]" style={{ color: TEXT_MUTED }}>
              Sem dados no período
            </div>
          )}
        </div>

        {/* Top Agents */}
        <div className={CARD_CLASS} style={{ padding: 22 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
            <Users className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span style={{ fontSize: 14.5, fontWeight: 600, color: TEXT_PRIMARY }}>Top Agentes</span>
          </div>
          {agentData.length > 0 ? (
            <div className="flex flex-col">
              {agentData.map((agent, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                  style={{ padding: "10px 0", borderBottom: i < agentData.length - 1 ? `1px solid ${BORDER_DEFAULT}` : "none" }}
                >
                  <Avatar name={agent.name} src={agent.photo ?? undefined} size="md" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</div>
                    <div style={{ fontSize: 12, color: TEXT_MUTED }}>{agent.total} chamados atribuídos</div>
                  </div>
                  <Badge variant="ok">{agent.resolved} resolvidos</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px]" style={{ color: TEXT_MUTED }}>
              Nenhum agente com chamados no período
            </div>
          )}
        </div>
      </div>

      {/* Incidents Summary */}
      <div className={CARD_CLASS} style={{ padding: 22 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
          <AlertTriangle className="h-3.5 w-3.5" style={{ color: ERROR }} />
          <span style={{ fontSize: 14.5, fontWeight: 600, color: TEXT_PRIMARY }}>Resumo de Incidentes</span>
        </div>
        <p style={{ fontSize: 11.5, color: TEXT_MUTED, margin: "0 0 18px" }}>
          Filtrado pelo mesmo período acima{canFilterSector ? " — sem filtro de setor (incidentes não têm setor cadastrado)" : ""}
        </p>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div style={{ background: "var(--mg-color-bg-surface)", border: `1px solid ${BORDER_DEFAULT}`, borderRadius: "var(--mg-radius-md)", padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: TEXT_PRIMARY }}>{filteredIncidents.length}</div>
            <div style={{ fontSize: 12.5, color: TEXT_MUTED, marginTop: 6 }}>Total de Incidentes</div>
          </div>
          <div style={{ background: "var(--mg-color-bg-surface)", border: `1px solid ${BORDER_DEFAULT}`, borderRadius: "var(--mg-radius-md)", padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: ERROR }}>
              {filteredIncidents.filter((i) => !["resolved", "closed"].includes(i.status || "")).length}
            </div>
            <div style={{ fontSize: 12.5, color: TEXT_MUTED, marginTop: 6 }}>Ativos</div>
          </div>
          <div style={{ background: "var(--mg-color-bg-surface)", border: `1px solid ${BORDER_DEFAULT}`, borderRadius: "var(--mg-radius-md)", padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: SUCCESS }}>
              {filteredIncidents.filter((i) => ["resolved", "closed"].includes(i.status || "")).length}
            </div>
            <div style={{ fontSize: 12.5, color: TEXT_MUTED, marginTop: 6 }}>Resolvidos</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
