import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Badge } from "@suporte/components/ui/badge";
import { Progress } from "@suporte/components/ui/progress";
import { Clock, CheckCircle2, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { SlaInfo, SlaTimer, SlaUrgency } from "@suporte/hooks/useSlaStatus";
import { Button } from "@suporte/components/ui/button";

const priorityLabels: Record<string, string> = { p0: "Crítico", p1: "Alta", p2: "Média", p3: "Baixa" };
const priorityColors: Record<string, string> = {
  p0: "bg-red-600/30 text-red-300 border-red-500/50 animate-pulse",
  p1: "bg-red-500/20 text-red-400",
  p2: "bg-yellow-500/20 text-yellow-400",
  p3: "bg-green-500/20 text-green-400",
};

const slaProgressColors: Record<SlaUrgency, string> = {
  ok: "[&>div]:bg-green-500",
  warning: "[&>div]:bg-yellow-500",
  critical: "[&>div]:bg-orange-500",
  breached: "[&>div]:bg-red-500",
};

const urgencyTextColors: Record<SlaUrgency, string> = {
  ok: "text-muted-foreground",
  warning: "text-yellow-400",
  critical: "text-orange-400",
  breached: "text-red-400",
};

interface KanbanTicketCardProps {
  ticket: any;
  columnId: string;
  borderColor: string;
  isDragging: boolean;
  slaInfo?: SlaInfo;
  unreadComments?: number;
  onClick: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

function DeadlineDisplay({ timer }: { timer: SlaTimer }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className={`flex items-center gap-1 font-medium ${urgencyTextColors[timer.urgency]}`}>
          <Clock className="h-3 w-3" />
          <span className="text-muted-foreground/70">Prazo:</span> {timer.label}
        </span>
        <span className="text-muted-foreground">{Math.round(timer.percentUsed)}%</span>
      </div>
      <Progress
        value={Math.min(100, timer.percentUsed)}
        className={`h-1 ${slaProgressColors[timer.urgency]}`}
      />
    </div>
  );
}

export const KanbanTicketCard = ({
  ticket,
  columnId,
  borderColor,
  isDragging,
  slaInfo,
  unreadComments,
  onClick,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: KanbanTicketCardProps) => {
  const isResolved = columnId === "resolved";

  const urgency = slaInfo?.deadline?.urgency ?? null;
  const slaBorderMap: Record<SlaUrgency, string> = {
    ok: "",
    warning: "ring-1 ring-yellow-500/40",
    critical: "ring-2 ring-orange-500/60",
    breached: "ring-2 ring-red-500/80 shadow-red-500/20 shadow-lg",
  };
  const slaUrgencyBorder = !isResolved && urgency ? slaBorderMap[urgency] : "";

  return (
    // min-w-0: a coluna do Kanban é flex-col, e sem isso o card (item flex)
    // usa min-width:auto — como a linha "Aberto por: X · Para: Y" é
    // white-space:nowrap (por causa do truncate), o card se recusa a
    // encolher abaixo da largura inteira do texto e estoura a coluna em vez
    // de truncar com reticências.
    <div onClick={onClick} className="min-w-0">
      <Card
        className={`cursor-pointer transition-all h-[180px] flex flex-col min-w-0 ${borderColor ? `border-l-4 ${borderColor}` : ""} ${isDragging ? "shadow-lg ring-2 ring-primary/30 rotate-2" : "hover:border-primary/50"} ${isResolved ? "opacity-75 hover:opacity-100" : ""} ${slaUrgencyBorder}`}
      >
        <CardHeader className="p-3 pb-1 flex-none">
          <div className="flex justify-between items-start">
            <Badge variant="outline" className="text-xs">
              {String(ticket.ticket_code).padStart(3, "0")}
            </Badge>
            {isResolved ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Badge className={`text-[10px] ${priorityColors[ticket.priority || "p3"]}`}>
                {ticket.priority === "p0" && <AlertTriangle className="h-3 w-3 mr-1" />}
                {priorityLabels[ticket.priority || "p3"]}
              </Badge>
            )}
          </div>
          <CardTitle className={`text-sm mt-1 line-clamp-1 ${isResolved ? "line-through text-muted-foreground" : ""}`}>
            {ticket.title}
          </CardTitle>
          {/* opened_by só existe (e só difere do requester) quando alguém
              abriu o chamado em nome de outra pessoa pelo chat — chamado
              aberto pelo próprio solicitante mostra só o nome, como sempre. */}
          {ticket.opened_by_id && ticket.opened_by_id !== ticket.requester_id ? (
            <span className="text-[11px] text-muted-foreground truncate block">
              Aberto por: {ticket.opened_by?.full_name || "—"} · Para: {ticket.requester?.full_name || "—"}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground truncate block">
              {ticket.requester?.full_name || "Solicitante não informado"}
            </span>
          )}
        </CardHeader>
        <CardContent className="p-3 pt-0 flex-1 flex flex-col justify-end">
          {slaInfo?.deadline && !isResolved && (
            <div className="mb-1">
              <DeadlineDisplay timer={slaInfo.deadline} />
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {new Date(ticket.created_at!).toLocaleDateString()}
            </span>
            <div className="flex items-center gap-1">
              {(canMoveUp || canMoveDown) && (
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={!canMoveUp}
                    onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={!canMoveDown}
                    onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {!!unreadComments && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-pulse">
                  {unreadComments > 9 ? "9+" : unreadComments}
                </span>
              )}
              {ticket.assignee?.full_name && (
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">
                  {ticket.assignee.full_name.charAt(0)}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

