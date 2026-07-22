import { Badge } from "@suporte/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Button } from "@suporte/components/ui/button";
import { ShieldAlert, AlertTriangle, Clock, CheckCircle2, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@suporte/components/ui/dialog";
import { ScrollArea } from "@suporte/components/ui/scroll-area";
import { Separator } from "@suporte/components/ui/separator";

const severityConfig: Record<string, { label: string; className: string }> = {
  p0: { label: "Crítico", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  p1: { label: "Alto", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  p2: { label: "Médio", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  p3: { label: "Baixo", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  new: { label: "Novo", icon: ShieldAlert, className: "text-red-400" },
  open: { label: "Aberto", icon: AlertTriangle, className: "text-orange-400" },
  pending: { label: "Em Análise", icon: Clock, className: "text-yellow-400" },
  resolved: { label: "Resolvido", icon: CheckCircle2, className: "text-green-400" },
  closed: { label: "Fechado", icon: CheckCircle2, className: "text-muted-foreground" },
};

const Incidents = () => {
  const [selectedIncident, setSelectedIncident] = useState<any>(null);

  const { data: incidents, isLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: relatedTickets } = useQuery({
    queryKey: ["incident-tickets", selectedIncident?.id],
    queryFn: async () => {
      if (!selectedIncident) return [];
      const { data, error } = await supabase
        .from("tickets")
        .select(`*, requester:profiles!requester_id(full_name, email)`)
        .eq("incident_id", selectedIncident.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedIncident,
  });

  const activeIncidents = incidents?.filter((i) => !["resolved", "closed"].includes(i.status || "")) || [];
  const resolvedIncidents = incidents?.filter((i) => ["resolved", "closed"].includes(i.status || "")) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando incidentes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Incidentes</h2>
        <p className="text-muted-foreground">
          Monitoramento de incidentes detectados automaticamente
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{activeIncidents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolvidos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{resolvedIncidents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <AlertTriangle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidents?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Afetados</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">—</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Incidents */}
      {activeIncidents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Incidentes Ativos
          </h3>
          <div className="space-y-3">
            {activeIncidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                onView={() => setSelectedIncident(incident)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resolved Incidents */}
      {resolvedIncidents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-muted-foreground">Histórico de Incidentes</h3>
          <div className="space-y-3">
            {resolvedIncidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                onView={() => setSelectedIncident(incident)}
              />
            ))}
          </div>
        </div>
      )}

      {incidents?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-400 mb-4" />
            <p className="text-lg font-medium">Nenhum incidente registrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Incidentes são criados automaticamente quando 5+ chamados da mesma categoria surgem em 10 minutos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              {selectedIncident?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {selectedIncident?.severity && (
                <Badge className={severityConfig[selectedIncident.severity]?.className}>
                  {severityConfig[selectedIncident.severity]?.label}
                </Badge>
              )}
              {selectedIncident?.status && (
                <Badge variant="outline">
                  {statusConfig[selectedIncident.status]?.label || selectedIncident.status}
                </Badge>
              )}
            </div>

            {selectedIncident?.description && (
              <p className="text-sm text-muted-foreground">{selectedIncident.description}</p>
            )}

            <div className="text-xs text-muted-foreground">
              Criado em:{" "}
              {selectedIncident?.created_at &&
                format(new Date(selectedIncident.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-3">Tickets Relacionados</h4>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {relatedTickets?.length ? (
                    relatedTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                      >
                        <div>
                          <p className="text-sm font-medium"><p className="text-sm font-medium">{String(ticket.ticket_code).padStart(3, '0')}</p></p>
                          <p className="text-xs text-muted-foreground">{ticket.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {ticket.requester?.full_name || ticket.requester?.email}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {ticket.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum ticket vinculado.</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function IncidentCard({ incident, onView }: { incident: any; onView: () => void }) {
  const status = statusConfig[incident.status || "new"];
  const severity = severityConfig[incident.severity || "p1"];
  const StatusIcon = status?.icon || ShieldAlert;

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg bg-card ${status?.className}`}>
            <StatusIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">{incident.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {incident.created_at &&
                format(new Date(incident.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={severity?.className}>{severity?.label}</Badge>
          <Badge variant="outline">{status?.label}</Badge>
          <Button variant="ghost" size="icon" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default Incidents;

