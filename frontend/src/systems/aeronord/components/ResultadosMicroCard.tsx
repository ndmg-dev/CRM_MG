import React from 'react';
import { ConvencaoCalculos } from '@aeronord/types/convencao';
import { formatCurrency } from '@aeronord/utils/calculos';

interface ResultadosMicroCardProps {
  calculos: ConvencaoCalculos;
}

export function ResultadosMicroCard({ calculos }: ResultadosMicroCardProps) {
  const items = [
    { label: 'Horas x Valor/Hora', value: calculos.resultado1, key: 'r1' },
    { label: 'DSR', value: calculos.resultado2, key: 'r2' },
    { label: 'Periculosidade', value: calculos.resultado3, key: 'r3' },
    { label: 'Alimentação', value: calculos.resultado4, key: 'r4' },
    { label: 'Férias', value: calculos.resultado5, key: 'r5' },
    { label: '1/3 Férias', value: calculos.resultado6, key: 'r6' },
    { label: '13º Salário', value: calculos.resultado7, key: 'r7' },
  ];

  return (
    <div className="bg-card-secondary border border-border rounded-lg p-4">
      <h4 className="font-display text-lg text-primary mb-4 tracking-wide">RESULTADOS</h4>
      
      {/* Grid of micro-cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {items.map((item) => (
          <div key={item.key} className="result-micro-card">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">
              {item.label}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {formatCurrency(item.value)}
            </p>
          </div>
        ))}
        
        {/* INSS - Desconto */}
        <div className="result-micro-card border-destructive/30">
          <p className="text-[10px] uppercase text-destructive tracking-wide mb-1">
            INSS (7,5%)
          </p>
          <p className="text-sm font-semibold text-destructive">
            - {formatCurrency(calculos.inss)}
          </p>
        </div>
      </div>

      {/* Totals */}
      <div className="space-y-2 pt-3 border-t border-border/50">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Total Proventos</span>
          <span className="text-foreground font-medium">{formatCurrency(calculos.totalProventos)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Total Descontos</span>
          <span className="text-destructive font-medium">- {formatCurrency(calculos.totalDescontos)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-primary/30">
          <span className="text-primary font-semibold">Líquido a Receber</span>
          <span className="text-primary font-bold text-lg">{formatCurrency(calculos.liquidoReceber)}</span>
        </div>
      </div>
    </div>
  );
}
