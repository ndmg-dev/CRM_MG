import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Badge } from "@suporte/components/ui/badge";
import { Button } from "@suporte/components/ui/button";
import { Input } from "@suporte/components/ui/input";
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
import { Search, PlusCircle, Clock, Eye } from "lucide-react";
import { useNavigate } from "@suporte/lib/router-shim";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { TicketDetailDialog } from "@suporte/components/admin/TicketDetailDialog";

const statusLabels: Record<string, string> = {
  new: "Novo",
  open: "Em Andamento",
  pending: "Aguardando",
  testing: "Em Teste",
  resolved: "Resolvido",
  closed: "Fechado",
  canceled: "Cancelado",
};

const statusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-500",
  open: "bg-green-500/10 text-green-500",
  pending: "bg-yellow-500/10 text-yellow-500",
  testing: "bg-orange-500/10 text-orange-500",
  resolved: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
  canceled: "bg-destructive/10 text-destructive",
};

const priorityLabels: Record<string, string> = {
  p0: "Crítica",
  p1: "Alta",
  p2: "Média",
  p3: "Baixa",
};

const MyTickets = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const filtered = tickets?.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        String(t.ticket_code).includes(q)
      );
    }
    return true;
  }) || [];

  const counts = {
    total: tickets?.length || 0,
    open: tickets?.filter(t => t.status === "open" || t.status === "new").length || 0,
    pending: tickets?.filter(t => t.status === "pending").length || 0,
    resolved: tickets?.filter(t => t.status === "resolved" || t.status === "closed").length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Meus Chamados</h2>
          <p className="text-muted-foreground text-sm">Acompanhe todas as suas solicitações</p>
        </div>
        <Button onClick={() => navigate("/portal/new-ticket")}>
          <PlusCircle className="h-4 w-4 mr-2" /> Chamado Interno
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent><span className="text-2xl font-bold">{counts.total}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">Abertos</CardTitle>
          </CardHeader>
          <CardContent><span className="text-2xl font-bold text-blue-500">{counts.open}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">Aguardando</CardTitle>
          </CardHeader>
          <CardContent><span className="text-2xl font-bold text-yellow-500">{counts.pending}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">Concluídos</CardTitle>
          </CardHeader>
          <CardContent><span className="text-2xl font-bold text-green-500">{counts.resolved}</span></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-6">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhum chamado encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Prioridade</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-accent/5"
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono"><Badge variant="outline" className="text-xs font-mono">{String(ticket.ticket_code).padStart(3, '0')}</Badge></Badge>
                    </TableCell>
                    <TableCell className="font-medium">{ticket.title}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {ticket.category?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] font-medium ${statusColors[ticket.status || "new"]} border-0`}>
                        {statusLabels[ticket.status || "new"]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={ticket.priority === "p0" || ticket.priority === "p1" ? "destructive" : "secondary"} className="text-[10px]">
                        {priorityLabels[ticket.priority || "p3"]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {new Date(ticket.created_at!).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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


