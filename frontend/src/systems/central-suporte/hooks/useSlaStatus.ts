import { useMemo } from "react";

export type SlaUrgency = "ok" | "warning" | "critical" | "breached";

export interface SlaTimer {
  urgency: SlaUrgency;
  elapsedMs: number;
  totalMs: number;
  label: string;
  percentUsed: number;
}

export interface SlaInfo {
  deadline?: SlaTimer;
}

export function useSlaStatus(tickets: any[] | undefined) {
  const slaMap = useMemo(() => {
    const map: Record<string, SlaInfo> = {};
    if (!tickets) return map;

    const now = Date.now();

    for (const ticket of tickets) {
      if (["resolved", "closed", "canceled"].includes(ticket.status)) continue;
      if (!ticket.due_date) continue;

      const dueDate = new Date(ticket.due_date).getTime();
      const createdAt = new Date(ticket.created_at!).getTime();
      const totalMs = dueDate - createdAt;
      const elapsedMs = now - createdAt;
      const remainingMs = dueDate - now;
      const percentUsed = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : (remainingMs <= 0 ? 100 : 0);

      const isBreached = now >= dueDate;

      map[ticket.id] = {
        deadline: {
          urgency: isBreached ? "breached" : getUrgency(percentUsed),
          elapsedMs,
          totalMs,
          label: isBreached ? `Atrasado ${formatElapsed(now - dueDate)}` : `Resta ${formatElapsed(remainingMs)}`,
          percentUsed,
        },
      };
    }

    return map;
  }, [tickets]);

  return slaMap;
}

function getUrgency(percentUsed: number): SlaUrgency {
  if (percentUsed >= 100) return "breached";
  if (percentUsed >= 75) return "critical";
  if (percentUsed >= 50) return "warning";
  return "ok";
}

function formatElapsed(ms: number): string {
  const absMs = Math.abs(ms);
  const days = Math.floor(absMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

