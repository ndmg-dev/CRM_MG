import { ShieldCheck, AlertTriangle, HelpCircle } from 'lucide-react';
import type { ConfidenceLevel } from '@adiantamento/lib/types';

const config: Record<ConfidenceLevel, { icon: typeof ShieldCheck; label: string; classes: string }> = {
  high: {
    icon: ShieldCheck,
    label: 'Alta confiança',
    classes: 'text-emerald-400/80 border-emerald-400/20 bg-emerald-400/5',
  },
  review: {
    icon: AlertTriangle,
    label: 'Revisão recomendada',
    classes: 'text-amber-400/80 border-amber-400/20 bg-amber-400/5',
  },
  missing: {
    icon: HelpCircle,
    label: 'Campo ausente',
    classes: 'text-red-400/80 border-red-400/20 bg-red-400/5',
  },
};

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const { icon: Icon, label, classes } = config[level];
  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium border transition-all ${classes}`}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}
