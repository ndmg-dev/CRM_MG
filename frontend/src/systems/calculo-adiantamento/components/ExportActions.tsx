import { Download, CheckSquare, Trash2 } from 'lucide-react';
import { Button } from '@adiantamento/components/ui/button';
import type { EmployeeAdvance, CalcConfig } from '@adiantamento/lib/types';
import { generateReceiptsPdf } from '@adiantamento/lib/pdf-generator';

interface ExportActionsProps {
  advances: EmployeeAdvance[];
  competencia: string;
  config: CalcConfig;
  selectedCount: number;
  onClear: () => void;
}

export function ExportActions({ advances, competencia, config, selectedCount, onClear }: ExportActionsProps) {
  const handleExportAll = () => generateReceiptsPdf(advances, competencia, config);
  const handleExportSelected = () => {
    const selected = advances.filter((e) => e.selected);
    if (selected.length > 0) generateReceiptsPdf(selected, competencia, config);
  };

  return (
    <section className="flex flex-wrap items-center gap-3 justify-center pt-4 pb-12 animate-in fade-in duration-700">
      <Button
        onClick={handleExportAll}
        className="bg-primary text-primary-foreground hover:bg-primary/90 gold-glow font-semibold px-6 transition-all duration-300 hover:scale-[1.02]"
        size="lg"
      >
        <Download className="h-4 w-4 mr-2" />
        Exportar todos ({advances.length})
      </Button>

      {selectedCount > 0 && (
        <Button
          onClick={handleExportSelected}
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10 transition-all duration-300"
          size="lg"
        >
          <CheckSquare className="h-4 w-4 mr-2" />
          Exportar selecionados ({selectedCount})
        </Button>
      )}

      <Button
        variant="outline"
        onClick={onClear}
        className="border-destructive/30 text-destructive hover:bg-destructive/10 transition-all duration-300"
        size="lg"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Limpar
      </Button>
    </section>
  );
}
