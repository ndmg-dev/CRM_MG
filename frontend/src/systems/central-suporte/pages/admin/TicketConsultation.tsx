import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { format } from "date-fns";
import { useUserSector } from "@suporte/hooks/useUserSector";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Search, X } from "lucide-react";
import { cn } from "@suporte/lib/utils";
import { Button } from "@suporte/components/ui/button";
import { Input } from "@suporte/components/ui/input";
import { Badge } from "@suporte/components/ui/badge";
import { Calendar } from "@suporte/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@suporte/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@suporte/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@suporte/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { TicketDetailDialog } from "@suporte/components/admin/TicketDetailDialog";
import { Switch } from "@suporte/components/ui/switch";
import { Label } from "@suporte/components/ui/label";

const statusLabels: Record<string, string> = {
  new: "Novo",
  open: "Aberto",
  pending: "Pendente",
  parado: "Parado",
  testing: "Em Teste",
  resolved: "Resolvido",
  closed: "Fechado",
  canceled: "Cancelado",
};

const priorityLabels: Record<string, string> = {
  p0: "P0 - Crítica",
  p1: "P1 - Alta",
  p2: "P2 - Média",
  p3: "P3 - Baixa",
};

const priorityColors: Record<string, string> = {
  p0: "bg-destructive/20 text-destructive",
  p1: "bg-orange-500/20 text-orange-500",
  p2: "bg-yellow-500/20 text-yellow-500",
  p3: "bg-muted text-muted-foreground",
};

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  open: "bg-blue-500/20 text-blue-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  resolved: "bg-green-500/20 text-green-400",
  closed: "bg-green-500/20 text-green-400",
  canceled: "bg-muted text-muted-foreground",
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
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");
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
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", uniqueIds);
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

      query = showArchived
        ? query.not("archived_at", "is", null)
        : query.is("archived_at", null);

      // Direction, Coordinator TI, and Admin TI see all sectors (no filter)
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Consulta de Chamados</h2>
        <p className="text-muted-foreground">
          Pesquise e filtre chamados por data, categoria ou usuário
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Buscar</label>
              <Input
                placeholder="Código, título ou usuário..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-[220px] h-9 text-sm"
              />
            </div>

            {/* Date from */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[150px] h-9 justify-start text-left text-sm font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date to */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[150px] h-9 justify-start text-left text-sm font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Select
                value={categoryId || "all"}
                onValueChange={(v) => setCategoryId(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Responsável</label>
              <Select
                value={assigneeId || "all"}
                onValueChange={(v) => setAssigneeId(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-[200px] h-9 text-sm">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos responsáveis</SelectItem>
                  <SelectItem value="unassigned">Sem responsável</SelectItem>
                  {staffProfiles?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-sm"
              >
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        {(sector.isDirection || sector.roles.includes("admin_ti")) && (
          <CardHeader className="pb-0">
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived-tickets"
                checked={showArchived}
                onCheckedChange={(checked) => {
                  setShowArchived(checked);
                  setSelectedTicketId(null);
                }}
              />
              <Label htmlFor="show-archived-tickets">Consultar chamados arquivados</Label>
            </div>
          </CardHeader>
        )}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando chamados...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum chamado encontrado com os filtros selecionados.
            </div>
          ) : (
            <>
              <div className="px-4 py-2 border-b text-xs text-muted-foreground">
                {filteredTickets.length} chamado{filteredTickets.length !== 1 ? "s" : ""} encontrado{filteredTickets.length !== 1 ? "s" : ""}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <TableCell className="font-mono font-bold">
                        #{String(ticket.ticket_code).padStart(3, "0")}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate font-medium">
                        {ticket.title}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(ticket.requester as any)?.full_name || (ticket.requester as any)?.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(ticket.assignee as any)?.full_name || (ticket.assignee as any)?.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(ticket.category as any)?.name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={priorityColors[ticket.priority || "p3"]}>
                          {priorityLabels[ticket.priority || "p3"]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[ticket.status || "new"]}>
                          {statusLabels[ticket.status || "new"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(ticket.created_at!), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

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

