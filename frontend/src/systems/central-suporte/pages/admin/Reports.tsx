import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Badge } from "@suporte/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@suporte/components/ui/select";
import { BarChart3, TrendingUp, Clock, CheckCircle2, AlertTriangle, Users, Timer, CalendarIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserSector } from "@suporte/hooks/useUserSector";
import { Button } from "@suporte/components/ui/button";
import { Calendar } from "@suporte/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@suporte/components/ui/popover";
import { cn } from "@suporte/lib/utils";

const COLORS = ["hsl(45,93%,47%)", "hsl(200,80%,50%)", "hsl(140,60%,45%)", "hsl(0,62%,50%)", "hsl(270,60%,55%)", "hsl(30,80%,55%)"];

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

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["report-tickets", effectiveSectorId],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select(`*, category:categories(name), assignee:profiles!assignee_id(full_name)`)
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

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((t) => {
      if (!t.created_at) return false;
      const created = new Date(t.created_at);
      // If custom dates are set, use them; otherwise use period dropdown
      if (dateFrom || dateTo) {
        if (dateFrom && isBefore(created, startOfDay(dateFrom))) return false;
        if (dateTo && isAfter(created, endOfDay(dateTo))) return false;
        return true;
      }
      const cutoff = subDays(new Date(), parseInt(period));
      return isAfter(created, cutoff);
    });
  }, [tickets, period, dateFrom, dateTo]);

  // Calculado somente sobre chamados ativos/não arquivados carregados acima.
  const metrics = useMemo(() => {
    const responseHours = filteredTickets
      .filter((ticket) => ticket.created_at && ticket.responded_at)
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
        !["resolved", "closed", "canceled"].includes(t.status || "")
    ).length;
  }, [filteredTickets]);

  const stats = useMemo(() => {
    const total = filteredTickets.length;
    const resolved = filteredTickets.filter((t) => ["resolved", "closed"].includes(t.status || "")).length;
    const open = filteredTickets.filter((t) => ["new", "open", "pending"].includes(t.status || "")).length;
    return { total, resolved, open };
  }, [filteredTickets]);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    const labels: Record<string, string> = {
      new: "Novo", open: "Aberto", pending: "Pendente",
      resolved: "Resolvido", closed: "Fechado", canceled: "Cancelado",
    };
    filteredTickets.forEach((t) => {
      const s = t.status || "new";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([key, value]) => ({
      name: labels[key] || key, value,
    }));
  }, [filteredTickets]);

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

  // Daily volume for line chart
  const dailyData = useMemo(() => {
    const days: Record<string, number> = {};
    const numDays = parseInt(period);
    for (let i = 0; i < numDays; i++) {
      const d = format(subDays(new Date(), i), "dd/MM");
      days[d] = 0;
    }
    filteredTickets.forEach((t) => {
      if (t.created_at) {
        const d = format(new Date(t.created_at), "dd/MM");
        if (days[d] !== undefined) days[d]++;
      }
    });
    return Object.entries(days)
      .reverse()
      .map(([date, chamados]) => ({ date, chamados }));
  }, [filteredTickets, period]);

  // Top agents
  const agentData = useMemo(() => {
    const counts: Record<string, { name: string; resolved: number; total: number }> = {};
    filteredTickets.forEach((t) => {
      if (t.assignee_id) {
        const name = t.assignee?.full_name || "Sem nome";
        if (!counts[t.assignee_id]) counts[t.assignee_id] = { name, resolved: 0, total: 0 };
        counts[t.assignee_id].total++;
        if (["resolved", "closed"].includes(t.status || "")) counts[t.assignee_id].resolved++;
      }
    });
    return Object.values(counts).sort((a, b) => b.resolved - a.resolved).slice(0, 5);
  }, [filteredTickets]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando relatórios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Relatórios</h2>
          <p className="text-muted-foreground">
            Métricas e indicadores de desempenho
            {!canFilterSector && sector.sectorName && (
              <span className="ml-1">— {sector.sectorName}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {canFilterSector && (
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {sectors?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={period} onValueChange={(v) => { setPeriod(v); setDateFrom(undefined); setDateTo(undefined); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" disabled={(date) => dateFrom ? isBefore(date, dateFrom) : false} />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
              Limpar datas
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Aberto</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolvidos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TM Resposta</CardTitle>
            <Timer className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {metrics?.avg_response_hours ? `${metrics.avg_response_hours}h` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TM Resolução</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.avg_resolution_hours ? `${metrics.avg_resolution_hours}h` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className={overdueCount > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Atrasados</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${overdueCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? "text-destructive" : ""}`}>
              {overdueCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Volume */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Volume Diário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" />
                <XAxis dataKey="date" fontSize={11} stroke="hsl(0,0%,65%)" />
                <YAxis fontSize={11} stroke="hsl(0,0%,65%)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(0,0%,5%)", border: "1px solid hsl(0,0%,20%)", borderRadius: "8px" }}
                  labelStyle={{ color: "hsl(0,0%,95%)" }}
                />
                <Line type="monotone" dataKey="chamados" stroke="hsl(45,93%,47%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Sem dados no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chamados por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" />
                  <XAxis dataKey="name" fontSize={11} stroke="hsl(0,0%,65%)" />
                  <YAxis fontSize={11} stroke="hsl(0,0%,65%)" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(0,0%,5%)", border: "1px solid hsl(0,0%,20%)", borderRadius: "8px" }}
                    labelStyle={{ color: "hsl(0,0%,95%)" }}
                  />
                  <Bar dataKey="count" fill="hsl(45,93%,47%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Sem dados no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Top Agentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agentData.length > 0 ? (
              <div className="space-y-4">
                {agentData.map((agent, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.total} chamados atribuídos</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-400 border-green-500/30">
                      {agent.resolved} resolvidos
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                Nenhum agente com chamados no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Incidents Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" /> Resumo de Incidentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg border border-border">
              <p className="text-2xl font-bold">{incidents?.length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Total de Incidentes</p>
            </div>
            <div className="text-center p-4 rounded-lg border border-red-500/20">
              <p className="text-2xl font-bold text-red-400">
                {incidents?.filter((i) => !["resolved", "closed"].includes(i.status || "")).length || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Ativos</p>
            </div>
            <div className="text-center p-4 rounded-lg border border-green-500/20">
              <p className="text-2xl font-bold text-green-400">
                {incidents?.filter((i) => ["resolved", "closed"].includes(i.status || "")).length || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Resolvidos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;

