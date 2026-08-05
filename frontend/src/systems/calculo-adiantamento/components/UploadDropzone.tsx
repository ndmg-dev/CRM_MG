import { useCallback, useState, useRef } from 'react';
import { Upload, FileText, ArrowUpFromLine } from 'lucide-react';
import { Button } from '@adiantamento/components/ui/button';
import { AiTelemetry } from '@adiantamento/components/AiTelemetry';
import type { ProcessingStep } from '@adiantamento/lib/types';

interface UploadDropzoneProps {
  processingStep: ProcessingStep;
  onFileSelect: (file: File) => void;
}

export function UploadDropzone({ processingStep, onFileSelect }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') onFileSelect(file);
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const isProcessing = processingStep !== 'idle' && processingStep !== 'done' && processingStep !== 'error';

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Section title */}
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight gold-text mb-3">
          Importar Folha de Pagamento
        </h2>
        <p className="text-sm text-muted-foreground/80 max-w-md mx-auto leading-relaxed">
          Envie o arquivo PDF da folha de pagamento para extrair dados e calcular
          automaticamente os adiantamentos salariais.
        </p>
      </div>

      {/* Upload card */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative rounded-2xl text-center cursor-pointer
          transition-all duration-500 ease-out
          glass-panel-rich
          ${isDragging
            ? 'gold-glow border-primary/30 scale-[1.01]'
            : 'hover:scale-[1.005] hover:border-primary/15'
          }
          ${isProcessing ? 'pointer-events-none opacity-70' : ''}
        `}
        onClick={() => !isProcessing && inputRef.current?.click()}
      >
        {/* Inner frame - subtle inset border */}
        <div className="absolute inset-[1px] rounded-2xl border border-glass-highlight/30 pointer-events-none" />

        {/* Radial glow behind content */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-primary/[0.04] blur-[60px]" />
        </div>

        <div className="relative p-12">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            onChange={handleChange}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-5">
            {isProcessing ? (
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-2 border-primary/10" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                <div className="absolute inset-2 rounded-full border border-primary/5" />
              </div>
            ) : (
              <div className="relative group">
                {/* Glow behind icon */}
                <div className="absolute -inset-4 rounded-full bg-primary/[0.06] blur-xl transition-all duration-700 group-hover:bg-primary/[0.10] animate-pulse-gold" />
                <div className="relative h-16 w-16 rounded-2xl glass-panel-rich flex items-center justify-center gold-border transition-all duration-500 group-hover:scale-105">
                  {processingStep === 'done' ? (
                    <FileText className="h-7 w-7 text-primary/90" />
                  ) : (
                    <ArrowUpFromLine className="h-7 w-7 text-primary/80 transition-transform duration-500 group-hover:-translate-y-0.5" />
                  )}
                </div>
              </div>
            )}

            {isProcessing ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-primary animate-pulse tracking-wide">
                  {processingStep === 'reading' && 'Lendo arquivo...'}
                  {processingStep === 'analyzing' && 'Analisando com IA...'}
                  {processingStep === 'structuring' && 'Estruturando colaboradores...'}
                </p>
                <div className="w-32 h-[2px] mx-auto rounded-full overflow-hidden bg-primary/10">
                  <div className="h-full bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-shimmer" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground/80">
                    Arraste o PDF aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground/50">
                    Formato aceito: PDF da folha de pagamento
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-premium rounded-lg px-6 py-2.5 text-xs font-semibold tracking-wide uppercase"
                >
                  Selecionar arquivo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Telemetry panel */}
      {isProcessing && (
        <AiTelemetry processingStep={processingStep} />
      )}
    </div>
  );
}
