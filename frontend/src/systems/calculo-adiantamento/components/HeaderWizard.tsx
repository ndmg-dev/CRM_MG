import { Upload, Brain, CheckCircle2, FileDown, Check } from 'lucide-react';
import type { ProcessingStep } from '@adiantamento/lib/types';

interface WizardStep {
  key: string;
  label: string;
  icon: React.ElementType;
}

const steps: WizardStep[] = [
  { key: 'import', label: 'Importar folha', icon: Upload },
  { key: 'extract', label: 'Extrair dados', icon: Brain },
  { key: 'validate', label: 'Validar cálculos', icon: CheckCircle2 },
  { key: 'export', label: 'Exportar recibos', icon: FileDown },
];

function getActiveIndex(processingStep: ProcessingStep, hasData: boolean): number {
  if (processingStep === 'idle') return 0;
  if (processingStep === 'reading' || processingStep === 'analyzing') return 1;
  if (processingStep === 'structuring') return 2;
  if (processingStep === 'done' && hasData) return 3;
  return 0;
}

export function HeaderWizard({
  processingStep,
  hasData,
}: {
  processingStep: ProcessingStep;
  hasData: boolean;
}) {
  const activeIndex = getActiveIndex(processingStep, hasData);

  return (
    <div className="hidden lg:flex items-center gap-0 flex-1 justify-center max-w-xl mx-6">
      {steps.map((step, i) => {
        const isCompleted = i < activeIndex;
        const isActive = i === activeIndex;
        const isFuture = i > activeIndex;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1.5 relative group">
              {/* Node circle */}
              <div
                className={`
                  relative flex items-center justify-center w-7 h-7 rounded-full
                  transition-all duration-500 ease-out
                  ${isActive
                    ? 'bg-primary/15 border border-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.15)]'
                    : isCompleted
                      ? 'bg-primary/10 border border-primary/25'
                      : 'bg-white/[0.03] border border-white/[0.06]'
                  }
                `}
              >
                {/* Active pulse ring */}
                {isActive && (
                  <div className="absolute inset-0 rounded-full border border-primary/20 animate-[pulse_3s_ease-in-out_infinite]" />
                )}
                {isCompleted ? (
                  <Check className="h-3 w-3 text-primary/70" strokeWidth={2.5} />
                ) : (
                  <Icon
                    className={`h-3 w-3 transition-colors duration-500 ${
                      isActive ? 'text-primary/90' : 'text-muted-foreground/30'
                    }`}
                    strokeWidth={1.8}
                  />
                )}
              </div>
              {/* Label */}
              <span
                className={`
                  text-[9px] font-medium tracking-[0.04em] uppercase whitespace-nowrap
                  transition-all duration-500
                  ${isActive
                    ? 'text-primary/80'
                    : isCompleted
                      ? 'text-primary/50'
                      : 'text-muted-foreground/25'
                  }
                `}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="flex-1 h-px mx-1.5 relative top-[-9px]">
                <div
                  className={`
                    h-full w-full transition-all duration-700 ease-out
                    ${i < activeIndex
                      ? 'bg-gradient-to-r from-primary/30 to-primary/20'
                      : 'bg-white/[0.04]'
                    }
                  `}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
