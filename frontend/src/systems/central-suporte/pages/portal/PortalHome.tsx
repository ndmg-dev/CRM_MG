import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Button } from "@suporte/components/ui/button";
import { PlusCircle, Clock, CheckCircle2, Monitor, Building2 } from "lucide-react";
import { useNavigate } from "@suporte/lib/router-shim";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@suporte/components/ui/dialog";
import { useState } from "react";

const Portal = () => {
  const navigate = useNavigate();
  const [showTicketChoice, setShowTicketChoice] = useState(false);

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
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: activeCount } = useQuery({
    queryKey: ["active-tickets-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("requester_id", user.id)
        .is("archived_at", null)
        .not("status", "in", '("resolved","closed","canceled")');
      
      if (error) throw error;
      return count || 0;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "text-blue-500 bg-blue-500/10";
      case "open": return "text-green-500 bg-green-500/10";
      case "pending": return "text-yellow-500 bg-yellow-500/10";
      case "resolved": return "text-gray-500 bg-gray-500/10";
      default: return "text-gray-500 bg-gray-500/10";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "new": return "Novo";
      case "open": return "Aberto";
      case "pending": return "Pendente";
      case "resolved": return "Resolvido";
      case "closed": return "Fechado";
      default: return status;
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:bg-accent/5 transition-colors cursor-pointer border-primary/20" onClick={() => setShowTicketChoice(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abrir Chamado</CardTitle>
            <PlusCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Novo Ticket</div>
            <p className="text-xs text-muted-foreground">Relatar problema ou solicitar serviço</p>
          </CardContent>
        </Card>

        <Dialog open={showTicketChoice} onOpenChange={setShowTicketChoice}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Qual tipo de chamado deseja abrir?</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Card 
                className="hover:bg-accent/10 transition-colors cursor-pointer border-primary/20"
                onClick={() => { setShowTicketChoice(false); navigate("/portal/new-ticket-ti"); }}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <Monitor className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">Chamado TI</p>
                    <p className="text-xs text-muted-foreground">Problemas técnicos, sistemas, equipamentos</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="hover:bg-accent/10 transition-colors cursor-pointer border-primary/20"
                onClick={() => { setShowTicketChoice(false); navigate("/portal/new-ticket"); }}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <Building2 className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">Chamado Interno</p>
                    <p className="text-xs text-muted-foreground">Solicitações entre setores da empresa</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="hover:bg-accent/5 transition-colors cursor-pointer border-primary/20" onClick={() => navigate("/portal/my-tickets")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meus Chamados</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount ?? 0} Ativos</div>
            <p className="text-xs text-muted-foreground">Acompanhe suas solicitações</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Chamados Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : recentTickets && recentTickets.length > 0 ? (
                recentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{ticket.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(ticket.ticket_code).padStart(3, '0')} • {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(ticket.status || "new")}`}>
                        {getStatusLabel(ticket.status || "new")}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum chamado recente.</p>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Portal;


