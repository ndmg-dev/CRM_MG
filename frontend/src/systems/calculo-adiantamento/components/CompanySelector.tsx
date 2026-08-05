import { Building2, Check } from 'lucide-react';
import { COMPANIES } from '@adiantamento/lib/types';
import type { CompanyId } from '@adiantamento/lib/types';

interface CompanySelectorProps {
  onSelect: (company: CompanyId) => void;
}

export function CompanySelector({ onSelect }: CompanySelectorProps) {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight gold-text mb-3">
          Selecione a empresa
        </h2>
        <p className="text-sm text-muted-foreground/80 max-w-md mx-auto leading-relaxed">
          Cada empresa utiliza uma fórmula diferente para o cálculo do adiantamento.
          Escolha antes de enviar a folha de pagamento.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {COMPANIES.map((company) => (
          <button
            key={company.id}
            type="button"
            onClick={() => onSelect(company.id)}
            className="group relative text-left rounded-2xl glass-panel-rich p-6 transition-all duration-500 hover:scale-[1.01] hover:border-primary/25 hover:gold-glow"
          >
            <div className="absolute inset-[1px] rounded-2xl border border-glass-highlight/30 pointer-events-none" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-2xl glass-panel-rich flex items-center justify-center gold-border">
                  <Building2 className="h-6 w-6 text-primary/85" />
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-primary">
                  <Check className="h-5 w-5" />
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{company.name}</h3>
                <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                  {company.description}
                </p>
              </div>
              <div className="rounded-lg border border-primary/15 bg-primary/[0.05] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-primary/70 font-semibold mb-0.5">
                  Fórmula
                </p>
                <p className="text-xs font-mono text-foreground/80">{company.formula}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
