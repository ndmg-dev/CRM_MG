import { Badge } from "@mg/ui";
import { ShieldAlert, AlertTriangle, Clock, CheckCircle2, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@suporte/components/ui/dialog";
import { ScrollArea } from "@suporte/components/ui/scroll-area";
import { Separator } from "@suporte/components/ui/separator";

// Tokens — ver frontend/packages/@mg/tokens/build/tokens.css. Handoff:
// Gestao Incidentes.dc.html.
const TEXT_PRIMARY = "var(--mg-color-text-primary)";
const TEXT_SECONDARY = "var(--mg-color-text-secondary)";
const TEXT_MUTED = "var(--mg-color-text-muted)";
const ERROR = "var(--mg-color-status-error)";
const SUCCESS = "var(--mg-color-status-success)";
const WARNING = "var(--mg-color-status-warning)";

const CARD_CLASS = "bg-[var(--mg-color-bg-card)] border border-[var(--mg-color-border-default)] rounded-xl";

const severityConfig: Record<string, { label: string; variant: "err" | "warn" | "ok" | "neutral" }> = {
  p0: { label: "Crítico", variant: "err" },
  p1: { label: "Alto", variant: "err" },
  p2: { label: "Médio", variant: "warn" },
  p3: { label: "Baixo", variant: "neutral" },
};

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  new: { label: "Novo", icon: ShieldAlert, color: ERROR },
  open: { label: "Aberto", icon: AlertTriangle, color: WARNING },
  pending: { label: "Em Análise", icon: Clock, color: WARNING },
  resolved: { label: "Resolvido", icon: CheckCircle2, color: SUCCESS },
  closed: { label: "Fechado", icon: CheckCircle2, color: TEXT_MUTED },
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
        <p style={{ color: TEXT_MUTED }}>Carregando incidentes...</p>
      </div>
    );
  }

  const kpis = [
    { label: "Ativos", value: activeIncidents.length, color: ERROR, icon: <ShieldAlert className="h-[18px] w-[18px]" /> },
    { label: "Resolvidos", value: resolvedIncidents.length, color: SUCCESS, icon: <CheckCircle2 className="h-[18px] w-[18px]" /> },
    { label: "Total", value: incidents?.length || 0, color: TEXT_PRIMARY, icon: <AlertTriangle className="h-[18px] w-[18px]" style={{ color: WARNING }} /> },
    { label: "Tickets Afetados", value: "—", color: TEXT_PRIMARY, icon: <Clock className="h-[18px] w-[18px]" style={{ color: TEXT_MUTED }} /> },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 style={{ color: TEXT_PRIMARY, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Incidentes</h1>
        <p style={{ color: TEXT_SECONDARY, fontSize: 13, margin: 0 }}>Monitoramento de incidentes detectados automaticamente</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={CARD_CLASS} style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
            {k.icon}
          </div>
        ))}
      </div>

      {activeIncidents.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 600, color: ERROR }}>
            <ShieldAlert className="h-4 w-4" /> Incidentes Ativos
          </h3>
          <div className="space-y-2.5">
            {activeIncidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} onView={() => setSelectedIncident(incident)} />
            ))}
          </div>
        </div>
      )}

      {resolvedIncidents.length > 0 && (
        <div className="space-y-3">
          <h3 style={{ fontSize: 15, fontWeight: 600, color: TEXT_SECONDARY }}>Histórico de Incidentes</h3>
          <div className="space-y-2.5">
            {resolvedIncidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} onView={() => setSelectedIncident(incident)} />
            ))}
          </div>
        </div>
      )}

      {incidents?.length === 0 && (
        <div className={CARD_CLASS} style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: `1.5px solid ${SUCCESS}`, color: SUCCESS, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, margin: "0 0 6px" }}>Nenhum incidente registrado</p>
          <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY, maxWidth: 420 }}>
            Incidentes são criados automaticamente quando 5+ chamados da mesma categoria surgem em 10 minutos.
          </p>
        </div>
      )}

      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" style={{ color: ERROR }} />
              {selectedIncident?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {selectedIncident?.severity && (
                <Badge variant={severityConfig[selectedIncident.severity]?.variant}>
                  {severityConfig[selectedIncident.severity]?.label}
                </Badge>
              )}
              {selectedIncident?.status && (
                <Badge variant="neutral">
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
                          <p className="text-sm font-medium">{String(ticket.ticket_code).padStart(3, '0')}</p>
                          <p className="text-xs text-muted-foreground">{ticket.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {ticket.requester?.full_name || ticket.requester?.email}
                          </p>
                        </div>
                        <Badge variant="neutral">{ticket.status}</Badge>
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
    <div className={CARD_CLASS} style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div className="flex items-center gap-3.5">
        <div style={{ padding: 8, borderRadius: 8, background: "var(--mg-color-bg-hover)", color: status?.color }}>
          <StatusIcon className="h-4 w-4" />
        </div>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>{incident.title}</p>
          <p style={{ fontSize: 11.5, color: TEXT_MUTED, margin: "2px 0 0" }}>
            {incident.created_at && format(new Date(incident.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <Badge variant={severity?.variant}>{severity?.label}</Badge>
        <Badge variant="neutral">{status?.label}</Badge>
        <button type="button" onClick={onView} style={{ background: "none", border: "none", color: TEXT_MUTED, cursor: "pointer", display: "flex" }}>
          <Eye className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default Incidents;
