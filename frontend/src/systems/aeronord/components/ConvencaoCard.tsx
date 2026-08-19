import React, { useMemo } from 'react';
import { Printer, Copy, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@aeronord/components/ui/button';
import { Input } from '@aeronord/components/ui/input';
import { Label } from '@aeronord/components/ui/label';
import { ResultadosMicroCard } from './ResultadosMicroCard';
import { Convencao } from '@aeronord/types/convencao';
import { calcularConvencao, formatMonthYear } from '@aeronord/utils/calculos';

interface ConvencaoCardProps {
  convencao: Convencao;
  onUpdate: (convencao: Convencao) => void;
  onDuplicate: (convencao: Convencao) => void;
  onRemove: (id: string) => void;
}

export function ConvencaoCard({ convencao, onUpdate, onDuplicate, onRemove }: ConvencaoCardProps) {
  const navigate = useNavigate();
  
  const calculos = useMemo(() => calcularConvencao(convencao), [convencao]);

  const handleChange = (field: keyof Convencao, value: string | number) => {
    onUpdate({
      ...convencao,
      [field]: value,
    });
  };

  const handlePrint = () => {
    navigate(`../recibo/${convencao.id}`, { relative: 'path' });
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden gold-glow-hover shadow-card">
      {/* Card header */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="font-display text-lg text-foreground tracking-wide">
            {convencao.mesReferencia ? formatMonthYear(convencao.mesReferencia).toUpperCase() : 'NOVA CONVOCAÇÃO'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          #{convencao.id.slice(-6)}
        </span>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Inputs */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground-muted text-sm">Mês Referência</Label>
                <Input
                  type="month"
                  value={convencao.mesReferencia}
                  onChange={(e) => handleChange('mesReferencia', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground-muted text-sm">Data Convocação</Label>
                <Input
                  type="date"
                  value={convencao.dataConvocacao || ''}
                  onChange={(e) => handleChange('dataConvocacao', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground-muted text-sm">Horas Trabalhadas</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={convencao.horas || ''}
                  onChange={(e) => handleChange('horas', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground-muted text-sm">Valor/Hora (R$)</Label>
                <Input
                  type="text"
                  value="9,00"
                  readOnly
                  className="bg-muted/50 cursor-not-allowed opacity-70"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground-muted text-sm">Empresa</Label>
                <Input
                  value={convencao.empresaNome}
                  onChange={(e) => handleChange('empresaNome', e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground-muted text-sm">CNPJ</Label>
              <Input
                value="11.471.554/0001-93"
                readOnly
                className="bg-muted/50 cursor-not-allowed opacity-70"
              />
            </div>
          </div>

          {/* Right column - Results */}
          <div>
            <ResultadosMicroCard calculos={calculos} />
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="px-4 py-3 bg-muted/20 border-t border-border/50 flex flex-wrap gap-2 justify-end">
        <Button variant="gold" size="sm" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-1" />
          Imprimir Recibo
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onDuplicate(convencao)}>
          <Copy className="w-4 h-4 mr-1" />
          Duplicar
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onRemove(convencao.id)}>
          <Trash2 className="w-4 h-4 mr-1" />
          Remover
        </Button>
      </div>
    </div>
  );
}
