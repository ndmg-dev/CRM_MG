import { Lock } from 'lucide-react';
import { HeaderWizard } from '@adiantamento/components/HeaderWizard';
import type { ProcessingStep } from '@adiantamento/lib/types';

export function PremiumHeader({
  processingStep = 'idle',
  hasData = false,
}: {
  processingStep?: ProcessingStep;
  hasData?: boolean;
}) {
  return (
    <header className="relative w-full z-20">
      <div className="glass-panel-strong rounded-b-2xl premium-shadow">
        <div className="max-w-7xl mx-auto px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            {/* Brand block */}
            <div className="flex items-center gap-5 shrink-0">
              <div className="relative">
                <div className="absolute -inset-1 rounded-xl bg-primary/5 blur-md" />
                <img
                  src="/logo-mendonca-galvao.png"
                  alt="Mendonça Galvão Contadores Associados"
                  className="relative h-14 w-auto object-contain drop-shadow-[0_2px_8px_oklch(0.78_0.11_85/15%)]"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <h1 className="text-xl font-bold tracking-tight gold-text leading-tight">
                  Sistema de Adiantamento Salarial
                </h1>
                <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-muted-foreground/70">
                  Mendonça Galvão Contadores Associados
                </p>
              </div>
            </div>

            {/* Wizard stepper */}
            <HeaderWizard processingStep={processingStep} hasData={hasData} />

            {/* Secure badge */}
            <div className="flex items-center gap-2.5 gold-border rounded-full px-5 py-2.5 bg-primary/[0.03] shrink-0">
              <div className="relative">
                <Lock className="h-3.5 w-3.5 text-primary/80" />
                <div className="absolute -inset-1 rounded-full bg-primary/10 blur-sm" />
              </div>
              <span className="text-[11px] font-semibold tracking-[0.06em] uppercase text-primary/80">
                Ambiente Seguro
              </span>
            </div>
          </div>
        </div>
        {/* Subtle gold gradient divider */}
        <div className="header-divider" />
      </div>
    </header>
  );
}
