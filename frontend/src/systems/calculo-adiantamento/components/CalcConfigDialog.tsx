import { useState, useEffect } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@adiantamento/components/ui/dialog';
import { Button } from '@adiantamento/components/ui/button';
import { Input } from '@adiantamento/components/ui/input';
import { Label } from '@adiantamento/components/ui/label';
import { Switch } from '@adiantamento/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@adiantamento/components/ui/radio-group';
import { formatCurrency, formatPercent, calcularAdiantamento } from '@adiantamento/lib/payroll-calc';
import type { CalcConfig, RoundingMode, EmployeePayroll } from '@adiantamento/lib/types';

interface CalcConfigDialogProps {
  config: CalcConfig;
  onSave: (config: CalcConfig) => void;
  onReset: () => void;
}

const ROUNDING_OPTIONS: { value: RoundingMode; label: string; hint: string }[] = [
  { value: 'floor', label: 'Para baixo', hint: 'Trunca os centavos (padrão)' },
  { value: 'round', label: 'Normal', hint: 'Arredonda 0,005 para cima' },
  { value: 'ceil', label: 'Para cima', hint: 'Sempre arredonda para cima' },
];

// Exemplo fixo para pré-visualizar o efeito da configuração
const PREVIEW_EMP = {
  liquido: 4710.74,
  descAdiantamento: 2900,
  bruto: 7610.74,
  planoSaude: 280,
  inss: 870.5,
  irrf: 410,
} as EmployeePayroll;

export function CalcConfigDialog({ config, onSave, onReset }: CalcConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalcConfig>(config);

  // Sincroniza o rascunho sempre que o diálogo abrir
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const preview = calcularAdiantamento(PREVIEW_EMP, draft);

  const handleSave = () => {
    const safePercent = Math.min(100, Math.max(0, Number(draft.percent) || 0));
    onSave({ ...draft, percent: safePercent });
    setOpen(false);
  };

  const handleReset = () => {
    onReset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary hover:bg-glass/40 transition-all duration-300"
        >
          <SlidersHorizontal className="h-4 w-4 mr-1.5" />
          Configurar cálculo
        </Button>
      </DialogTrigger>

      <DialogContent className="glass-panel border-glass-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="gold-text">Configurar cálculo do adiantamento</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Defina como o adiantamento é calculado. A IA continua apenas lendo os valores do PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Percentual */}
          <div className="space-y-2">
            <Label htmlFor="percent" className="text-xs uppercase tracking-wider text-foreground/80 font-semibold">
              Percentual aplicado
            </Label>
            <div className="relative">
              <Input
                id="percent"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={draft.percent}
                onChange={(e) => setDraft((d) => ({ ...d, percent: Number(e.target.value) }))}
                className="input-glass pr-8 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          {/* Subtrair desconto (apenas base Líquido) */}
          {draft.baseMode !== 'pe' && (
            <div className="flex items-center justify-between rounded-xl border border-glass-border/40 bg-glass/30 p-3">
              <div className="space-y-0.5 pr-3">
                <p className="text-sm font-medium text-foreground">Subtrair Desc. Adiant. Salarial</p>
                <p className="text-[11px] text-muted-foreground">
                  Desconta o adiantamento já lançado antes de aplicar o percentual.
                </p>
              </div>
              <Switch
                checked={draft.subtractAdiantamento}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, subtractAdiantamento: v }))}
              />
            </div>
          )}

          {draft.baseMode === 'pe' && (
            <div className="rounded-xl border border-glass-border/40 bg-glass/30 p-3">
              <p className="text-sm font-medium text-foreground">Base de cálculo</p>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                Bruto − Plano de Saúde − INSS − IRRF
              </p>
            </div>
          )}


          {/* Arredondamento */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-foreground/80 font-semibold">
              Arredondamento
            </Label>
            <RadioGroup
              value={draft.rounding}
              onValueChange={(v) => setDraft((d) => ({ ...d, rounding: v as RoundingMode }))}
              className="grid grid-cols-1 gap-2"
            >
              {ROUNDING_OPTIONS.map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`round-${opt.value}`}
                  className="flex items-center gap-3 rounded-lg border border-glass-border/40 bg-glass/20 px-3 py-2 cursor-pointer hover:border-primary/30 transition-colors"
                >
                  <RadioGroupItem id={`round-${opt.value}`} value={opt.value} />
                  <span className="flex-1">
                    <span className="text-sm text-foreground">{opt.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Pré-visualização */}
          <div className="rounded-xl border border-primary/15 bg-primary/[0.06] p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-[0.12em] text-primary/70 font-semibold">
              Prévia ({formatPercent(draft.percent)})
            </p>
            <p className="text-[11px] text-muted-foreground font-mono">
              {draft.baseMode === 'pe'
                ? `(${formatCurrency(PREVIEW_EMP.bruto)} − ${formatCurrency(PREVIEW_EMP.planoSaude)} − ${formatCurrency(PREVIEW_EMP.inss)} − ${formatCurrency(PREVIEW_EMP.irrf)})`
                : draft.subtractAdiantamento
                  ? `(${formatCurrency(PREVIEW_EMP.liquido)} − ${formatCurrency(PREVIEW_EMP.descAdiantamento)})`
                  : formatCurrency(PREVIEW_EMP.liquido)}{' '}
              × {formatPercent(draft.percent)} ={' '}
              <span className="gold-text font-bold">{formatCurrency(preview.valorAdiantamento)}</span>
            </p>

          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Restaurar padrão
          </Button>
          <Button onClick={handleSave} className="gold-glow">
            Salvar configuração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
