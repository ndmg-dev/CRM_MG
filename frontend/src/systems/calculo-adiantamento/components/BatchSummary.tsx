import { Users, DollarSign, Banknote, Pencil } from 'lucide-react';
import { formatCurrency } from '@adiantamento/lib/payroll-calc';
import type { BatchSummaryData } from '@adiantamento/lib/types';

interface BatchSummaryProps {
  data: BatchSummaryData;
}

export function BatchSummary({ data }: BatchSummaryProps) {
  const stats = [
    { label: 'Colaboradores', value: String(data.totalColaboradores), icon: Users },
    { label: 'Total Líquido', value: formatCurrency(data.totalLiquido), icon: DollarSign },
    { label: 'Total Adiantamentos', value: formatCurrency(data.totalAdiantamentos), icon: Banknote },
  ];

  const qualityStats = [
    ...(data.ajustesManuais > 0 ? [{ label: 'Ajustes manuais', value: String(data.ajustesManuais), icon: Pencil, warn: true }] : []),
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Resumo do Lote
        </h3>
        <span className="text-xs text-primary font-medium glass-panel rounded-full px-3 py-0.5">
          {data.competencia}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-panel-strong rounded-xl p-4 premium-shadow transition-all duration-200 hover:gold-glow-soft">
            <div className="relative z-10 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-base font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {qualityStats.length > 0 && (
        <div className="flex items-center gap-3">
          {qualityStats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2">
              <stat.icon className="h-3.5 w-3.5 text-amber-400/70" />
              <span className="text-xs text-amber-400/80 font-medium">{stat.value} {stat.label.toLowerCase()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
