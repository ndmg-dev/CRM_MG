import { useState, useEffect, useRef } from 'react';
import { Check, Brain, Calculator, ShieldCheck, FileSearch } from 'lucide-react';
import type { ProcessingStep } from '@adiantamento/lib/types';

interface TelemetryLine {
  tag: 'ia' | 'regra' | 'calc' | 'ok';
  text: string;
}

const READING_LINES: TelemetryLine[] = [
  { tag: 'ia', text: 'Lendo estrutura do PDF' },
  { tag: 'ia', text: 'Detectando formato da folha' },
  { tag: 'ia', text: 'Identificando blocos por colaborador' },
];

const ANALYZING_LINES: TelemetryLine[] = [
  { tag: 'ia', text: 'Extraindo nomes e matrículas' },
  { tag: 'ia', text: 'Identificando valor líquido do mês anterior' },
  { tag: 'regra', text: 'Validando "Líquido" e "Desc. Adiant. Salarial" por colaborador' },
  { tag: 'calc', text: 'Preparando base de cálculo' },
];

const STRUCTURING_LINES: TelemetryLine[] = [
  { tag: 'calc', text: 'Aplicando fórmula: líquido × 40%' },
  { tag: 'ia', text: 'Validando consistência dos dados' },
  { tag: 'ok', text: 'Dados estruturados com sucesso' },
];

const TAG_CONFIG: Record<TelemetryLine['tag'], { icon: typeof Brain; label: string; color: string }> = {
  ia: { icon: Brain, label: 'ia', color: 'text-primary/80' },
  regra: { icon: ShieldCheck, label: 'regra', color: 'text-blue-400/70' },
  calc: { icon: Calculator, label: 'calc', color: 'text-emerald-400/70' },
  ok: { icon: Check, label: 'ok', color: 'text-green-400/80' },
};

const MAX_VISIBLE = 5;

export function AiTelemetry({ processingStep }: { processingStep: ProcessingStep }) {
  const [visibleLines, setVisibleLines] = useState<TelemetryLine[]>([]);
  const [statusText, setStatusText] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleLines([]);
    indexRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);

    let lines: TelemetryLine[] = [];
    if (processingStep === 'reading') {
      lines = READING_LINES;
      setStatusText('Analisando folha com IA...');
    } else if (processingStep === 'analyzing') {
      lines = ANALYZING_LINES;
      setStatusText('Extraindo rubricas financeiras...');
    } else if (processingStep === 'structuring') {
      lines = STRUCTURING_LINES;
      setStatusText('Estruturando colaboradores...');
    } else {
      return;
    }

    if (lines.length === 0) return;
    setVisibleLines([lines[0]]);
    indexRef.current = 1;

    const baseDelay = processingStep === 'analyzing' ? 1800 : 1200;
    intervalRef.current = setInterval(() => {
      const idx = indexRef.current;
      if (idx < lines.length) {
        const line = lines[idx];
        if (line) {
          setVisibleLines((prev) => [...prev, line]);
        }
        indexRef.current = idx + 1;
      } else if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, baseDelay);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [processingStep]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLines]);

  const isActive = processingStep === 'reading' || processingStep === 'analyzing' || processingStep === 'structuring';
  if (!isActive) return null;

  const displayedLines = visibleLines.slice(-MAX_VISIBLE);

  return (
    <div className="w-full max-w-md mx-auto mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-center gap-2.5 mb-4">
        <FileSearch className="h-4 w-4 text-primary/70 animate-pulse" />
        <p className="text-sm font-semibold text-primary tracking-wide animate-pulse">
          {statusText}
        </p>
      </div>

      <div className="relative rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-md border border-white/[0.04] rounded-xl" />
        <div className="absolute inset-[1px] rounded-xl border border-white/[0.03] pointer-events-none" />

        <div
          ref={scrollRef}
          className="relative p-4 space-y-1.5 max-h-[140px] overflow-hidden"
        >
          {displayedLines.filter(Boolean).map((line, i) => {
            const config = TAG_CONFIG[line.tag];
            if (!config) return null;
            const Icon = config.icon;
            const isLast = i === displayedLines.length - 1;

            return (
              <div
                key={`${line.text}-${i}`}
                className={`
                  flex items-center gap-2.5 py-1 px-2 rounded-md
                  animate-in fade-in slide-in-from-bottom-1 duration-300
                  transition-opacity
                  ${isLast ? 'opacity-100' : 'opacity-50'}
                `}
                style={{ animationDelay: '0ms' }}
              >
                <div className={`flex items-center justify-center w-5 h-5 rounded ${config.color}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <span className={`text-[10px] font-mono font-medium uppercase tracking-wider ${config.color} w-10 shrink-0`}>
                  {config.label}
                </span>
                <div className="w-px h-3 bg-white/[0.06]" />
                <span className={`text-xs font-mono tracking-wide ${isLast ? 'text-foreground/70' : 'text-foreground/35'}`}>
                  {line.text}
                </span>
                {line.tag === 'ok' && (
                  <Check className="h-3 w-3 text-green-400/60 ml-auto shrink-0" />
                )}
              </div>
            );
          })}

          <div className="flex items-center gap-2.5 py-1 px-2">
            <div className="w-5 h-5" />
            <div className="w-1.5 h-3 bg-primary/40 rounded-sm animate-pulse" />
          </div>
        </div>

        {visibleLines.length > MAX_VISIBLE && (
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/60 to-transparent pointer-events-none rounded-t-xl" />
        )}
      </div>

      <div className="mt-3 w-full h-[2px] rounded-full overflow-hidden bg-white/[0.04]">
        <div className="h-full bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}
