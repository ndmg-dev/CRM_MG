import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency, formatPercent, calcBase } from '@adiantamento/lib/payroll-calc';
import type { EmployeeAdvance, CalcConfig } from '@adiantamento/lib/types';
import { DEFAULT_CALC_CONFIG } from '@adiantamento/lib/types';

interface AuditFormulaRowProps {
  employee: EmployeeAdvance;
  config?: CalcConfig;
}

export function AuditFormulaRow({ employee, config = DEFAULT_CALC_CONFIG }: AuditFormulaRowProps) {
  const [open, setOpen] = useState(false);
  const base = calcBase(employee, config);

  return (
    <div className="w-full rounded-xl border border-glass-border/40 overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground/80 transition-colors duration-200 group"
      >
        <span className="tracking-wide">Como este valor foi calculado</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-primary/60 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 space-y-4">
            {/* Base de cálculo */}
            <div className="space-y-2">
              <h5 className="text-[10px] uppercase tracking-[0.12em] text-primary/70 font-semibold">
                Base de cálculo
              </h5>
              <div className="rounded-lg bg-glass/30 border border-glass-border/30 p-3 space-y-1.5">
                {config.baseMode === 'pe' ? (
                  <>
                    <BaseLine label="Bruto" value={employee.bruto} origin={employee.fieldOrigins['bruto']} />
                    <BaseLine label="(−) Plano de Saúde" value={employee.planoSaude} origin={employee.fieldOrigins['planoSaude']} />
                    <BaseLine label="(−) INSS" value={employee.inss} origin={employee.fieldOrigins['inss']} />
                    <BaseLine label="(−) IRRF" value={employee.irrf} origin={employee.fieldOrigins['irrf']} />
                  </>
                ) : (
                  <>
                    <BaseLine label="Líquido" value={employee.liquido} origin={employee.fieldOrigins['liquido']} />
                    {config.subtractAdiantamento && (
                      <BaseLine label="(−) Desc. Adiant. Salarial" value={employee.descAdiantamento} origin={employee.fieldOrigins['descAdiantamento']} />
                    )}
                  </>
                )}
                <div className="flex items-center justify-between border-t border-glass-border/30 pt-1.5">
                  <span className="text-xs text-foreground/80 font-medium">Base de cálculo</span>
                  <span className="text-sm font-mono font-bold text-foreground">
                    {formatCurrency(base)}
                  </span>
                </div>
              </div>
            </div>


            {/* Adiantamento salarial */}
            <div className="space-y-2">
              <h5 className="text-[10px] uppercase tracking-[0.12em] text-primary/70 font-semibold">
                Adiantamento salarial
              </h5>
              <div className="rounded-lg bg-primary/[0.06] border border-primary/15 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground/70">
                    Base × {formatPercent(config.percent)}
                  </span>
                  <span className="text-sm font-mono font-bold gold-text">
                    {formatCurrency(employee.valorAdiantamento)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BaseLine({ label, value, origin }: { label: string; value: number; origin?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-foreground/70">{label}</span>
        <OriginTag origin={origin} />
      </div>
      <span className="text-sm font-mono font-bold text-foreground">
        {formatCurrency(value)}
      </span>
    </div>
  );
}


function OriginTag({ origin }: { origin?: string }) {
  if (!origin) return null;
  if (origin === 'manual') {
    return <span className="text-[8px] font-mono text-amber-400/60 border border-amber-400/15 rounded px-1">manual</span>;
  }
  return <span className="text-[8px] font-mono text-emerald-400/50 border border-emerald-400/10 rounded px-1">PDF</span>;
}
