import { Badge, Avatar } from "@mg/ui";
import { Clock, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { SlaInfo, SlaTimer, SlaUrgency } from "@suporte/hooks/useSlaStatus";
import { Button } from "@suporte/components/ui/button";

// Tokens — ver frontend/packages/@mg/tokens/build/tokens.css (importado
// globalmente em main.tsx). Handoff: Painel de Chamados.dc.html.
const GOLD = "var(--mg-color-gold-base)";
const TEXT_PRIMARY = "var(--mg-color-text-primary)";
const TEXT_SECONDARY = "var(--mg-color-text-secondary)";
const TEXT_MUTED = "var(--mg-color-text-muted)";
const BORDER_DEFAULT = "var(--mg-color-border-default)";
const BORDER_STRONG = "var(--mg-color-border-strong)";
const BG_CARD = "var(--mg-color-bg-card)";
const ERROR = "var(--mg-color-status-error)";

const priorityLabels: Record<string, string> = { p0: "Crítica", p1: "Alta", p2: "Média", p3: "Baixa" };
// Mapeia p0/p1 -> erro (vermelho), p2 -> aviso, p3 -> sucesso — o handoff
// só previa 3 níveis (Alta/Média/Baixa); p0 (crítico) herda a cor de Alta
// mas mantém o pulso extra que já existia.
const priorityVariant: Record<string, "err" | "warn" | "ok"> = { p0: "err", p1: "err", p2: "warn", p3: "ok" };
const priorityBorderColor: Record<string, string> = {
  p0: ERROR, p1: ERROR, p2: "var(--mg-color-status-warning)", p3: "var(--mg-color-status-success)",
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
  const barColor = timer.urgency === "breached" || timer.urgency === "critical" ? ERROR : GOLD;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: barColor, marginBottom: 5 }}>
        <span>Prazo: {timer.label}</span>
        <span style={{ fontWeight: 600 }}>{Math.round(timer.percentUsed)}%</span>
      </div>
      <div style={{ height: 4, background: BORDER_DEFAULT, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, timer.percentUsed)}%`, background: barColor, borderRadius: 999 }} />
      </div>
    </div>
  );
}

export const KanbanTicketCard = ({
  ticket,
  columnId,
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
  const priority = ticket.priority || "p3";
  const dueSource = ticket.due_date || ticket.created_at;
  const isOverdue = !isResolved && !!ticket.due_date && new Date(ticket.due_date) < new Date();

  const urgency = slaInfo?.deadline?.urgency ?? null;
  const slaRing: Record<SlaUrgency, string> = {
    ok: "none",
    warning: `1px solid rgba(245,158,11,0.4)`,
    critical: `2px solid rgba(245,158,11,0.6)`,
    breached: `2px solid rgba(239,68,68,0.8)`,
  };
  const outline = !isResolved && urgency ? slaRing[urgency] : "none";

  return (
    <div onClick={onClick} style={{ minWidth: 0, cursor: "pointer" }}>
      <div
        style={{
          background: BG_CARD,
          border: `0.5px solid ${BORDER_DEFAULT}`,
          borderLeft: `3px solid ${isResolved ? BORDER_STRONG : priorityBorderColor[priority]}`,
          borderRadius: 10,
          padding: "14px 14px 14px 12px",
          height: 180,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
          outline,
          outlineOffset: outline !== "none" ? -1 : undefined,
          boxShadow: isDragging ? "0 12px 28px rgba(0,0,0,0.4)" : undefined,
          opacity: isResolved ? 0.85 : 1,
          transition: "border-color 120ms ease",
        }}
      >
        <div className="flex justify-between items-center" style={{ marginBottom: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: TEXT_MUTED }}>
            #{String(ticket.ticket_code).padStart(3, "0")}
          </span>
          {!isResolved && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {priority === "p0" && <AlertTriangle className="h-3 w-3 animate-pulse" style={{ color: ERROR }} />}
              <Badge variant={priorityVariant[priority]}>{priorityLabels[priority]}</Badge>
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            lineHeight: 1.35,
            marginBottom: 8,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textDecoration: isResolved ? "line-through" : "none",
            color: isResolved ? TEXT_MUTED : TEXT_PRIMARY,
          }}
        >
          {ticket.title}
        </div>

        {/* Card mostra só o nome de pra quem é (requester) — mesmo quando
            alguém abriu em nome de outra pessoa. O "Aberto por: X · Para: Y"
            completo fica só no modal de detalhes, que tem espaço de sobra. */}
        <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
          <Avatar name={ticket.requester?.full_name || "?"} size="sm" />
          <span style={{ fontSize: 12, color: TEXT_SECONDARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ticket.requester?.full_name || "Solicitante não informado"}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {slaInfo?.deadline && !isResolved && <DeadlineDisplay timer={slaInfo.deadline} />}

        <div className="flex items-center justify-between" style={{ flexShrink: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: isOverdue ? ERROR : TEXT_MUTED }}>
            <Clock className="h-3 w-3" />
            {dueSource ? new Date(dueSource).toLocaleDateString() : "—"}
            {isOverdue && <span style={{ fontWeight: 700, marginLeft: 2 }}>· atrasado</span>}
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
              <span
                style={{
                  display: "flex", height: 20, minWidth: 20, alignItems: "center", justifyContent: "center",
                  borderRadius: 999, background: ERROR, padding: "0 4px", fontSize: 10, fontWeight: 700, color: "#fff",
                }}
                className="animate-pulse"
              >
                {unreadComments > 9 ? "9+" : unreadComments}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
