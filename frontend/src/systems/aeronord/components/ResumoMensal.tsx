import React, { useMemo, useCallback } from 'react';
import { Convencao } from '@aeronord/types/convencao';
import { calcularConvencao, formatCurrency, formatMonthYear, formatDate, VALOR_HORA_FIXO } from '@aeronord/utils/calculos';
import { Calendar, Printer, Copy } from 'lucide-react';
import { Button } from '@aeronord/components/ui/button';
import { toast } from '@aeronord/hooks/use-toast';

interface ResumoMensalProps {
  convencoes: Convencao[];
  mesSelecionado?: string;
}

interface ConvocacaoDetalhe {
  id: string;
  dataConvocacao: string;
  horas: number;
  valorDia: number;
}

export function ResumoMensal({ convencoes, mesSelecionado }: ResumoMensalProps) {
  const { resumo, detalhes } = useMemo(() => {
    // Filter by selected month if provided
    const filtered = mesSelecionado
      ? convencoes.filter((c) => c.mesReferencia === mesSelecionado)
      : convencoes;

    if (filtered.length === 0) {
      return { resumo: null, detalhes: [] };
    }

    // Calculate totals
    let quantidadeHoras = 0;
    let calculoDsr = 0;
    let periculosidade = 0;
    let alimentacao = 0;
    let ferias = 0;
    let tercoFerias = 0;
    let decimoTerceiro = 0;
    let inssTotal = 0;
    let totalProventos = 0;
    let liquidoMes = 0;

    const detalhesConvocacoes: ConvocacaoDetalhe[] = [];

    filtered.forEach((conv) => {
      const calc = calcularConvencao(conv);
      quantidadeHoras += calc.resultado1;
      calculoDsr += calc.resultado2;
      periculosidade += calc.resultado3;
      alimentacao += calc.resultado4;
      ferias += calc.resultado5;
      tercoFerias += calc.resultado6;
      decimoTerceiro += calc.resultado7;
      inssTotal += calc.inss;
      totalProventos += calc.totalProventos;
      liquidoMes += calc.liquidoReceber;

      detalhesConvocacoes.push({
        id: conv.id,
        dataConvocacao: conv.dataConvocacao,
        horas: conv.horas,
        valorDia: conv.horas * VALOR_HORA_FIXO,
      });
    });

    // Sort by date
    detalhesConvocacoes.sort((a, b) => 
      new Date(a.dataConvocacao).getTime() - new Date(b.dataConvocacao).getTime()
    );

    return {
      resumo: {
        count: filtered.length,
        quantidadeHoras,
        calculoDsr,
        periculosidade,
        alimentacao,
        ferias,
        tercoFerias,
        decimoTerceiro,
        inssTotal,
        totalProventos,
        liquidoMes,
      },
      detalhes: detalhesConvocacoes,
    };
  }, [convencoes, mesSelecionado]);

  const handleCopy = useCallback(() => {
    if (!resumo) return;
    
    const mesLabel = mesSelecionado ? formatMonthYear(mesSelecionado) : 'Geral';
    const text = `Resumo do Mês - ${mesLabel}
Quantidade de Horas: ${formatCurrency(resumo.quantidadeHoras)}
Cálculo DSR: ${formatCurrency(resumo.calculoDsr)}
Periculosidade: ${formatCurrency(resumo.periculosidade)}
Alimentação: ${formatCurrency(resumo.alimentacao)}
Férias: ${formatCurrency(resumo.ferias)}
Terço das Férias: ${formatCurrency(resumo.tercoFerias)}
13º Salário: ${formatCurrency(resumo.decimoTerceiro)}
INSS Total: - ${formatCurrency(resumo.inssTotal)}
Total Proventos: ${formatCurrency(resumo.totalProventos)}
Líquido do Mês: ${formatCurrency(resumo.liquidoMes)}`;

    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: 'Copiado!',
        description: 'Resultados copiados para a área de transferência.',
      });
    });
  }, [resumo, mesSelecionado]);

  const handlePrint = useCallback(() => {
    if (!resumo) return;

    const mesLabel = mesSelecionado ? formatMonthYear(mesSelecionado).toUpperCase() : 'GERAL';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Resumo do Mês - ${mesLabel}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 40px; 
            color: #111; 
            background: white;
          }
          h1 { 
            font-size: 24px; 
            text-align: center; 
            margin-bottom: 8px;
            color: #111;
          }
          h2 { 
            font-size: 16px; 
            text-align: center; 
            margin-bottom: 32px;
            color: #333;
            font-weight: normal;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 32px;
          }
          .item {
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .item-label {
            font-size: 11px;
            color: #555;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .item-value {
            font-size: 16px;
            font-weight: 600;
            color: #111;
          }
          .item-value.deduction {
            color: #c00;
          }
          .totals {
            border-top: 2px solid #111;
            padding-top: 16px;
            display: flex;
            justify-content: flex-end;
            gap: 32px;
          }
          .total-item {
            text-align: right;
          }
          .total-label {
            font-size: 11px;
            color: #555;
            text-transform: uppercase;
          }
          .total-value {
            font-size: 20px;
            font-weight: bold;
            color: #111;
          }
          .total-value.highlight {
            color: #b8860b;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <h1>RESUMO DO MÊS</h1>
        <h2>${mesLabel} — ${resumo.count} convocação(ões)</h2>
        
        <div class="grid">
          <div class="item">
            <div class="item-label">Quantidade de Horas</div>
            <div class="item-value">${formatCurrency(resumo.quantidadeHoras)}</div>
          </div>
          <div class="item">
            <div class="item-label">Cálculo DSR</div>
            <div class="item-value">${formatCurrency(resumo.calculoDsr)}</div>
          </div>
          <div class="item">
            <div class="item-label">Periculosidade</div>
            <div class="item-value">${formatCurrency(resumo.periculosidade)}</div>
          </div>
          <div class="item">
            <div class="item-label">Alimentação</div>
            <div class="item-value">${formatCurrency(resumo.alimentacao)}</div>
          </div>
          <div class="item">
            <div class="item-label">Férias</div>
            <div class="item-value">${formatCurrency(resumo.ferias)}</div>
          </div>
          <div class="item">
            <div class="item-label">Terço das Férias</div>
            <div class="item-value">${formatCurrency(resumo.tercoFerias)}</div>
          </div>
          <div class="item">
            <div class="item-label">13º Salário</div>
            <div class="item-value">${formatCurrency(resumo.decimoTerceiro)}</div>
          </div>
          <div class="item">
            <div class="item-label">INSS Total</div>
            <div class="item-value deduction">- ${formatCurrency(resumo.inssTotal)}</div>
          </div>
        </div>
        
        <div class="totals">
          <div class="total-item">
            <div class="total-label">Total Proventos</div>
            <div class="total-value">${formatCurrency(resumo.totalProventos)}</div>
          </div>
          <div class="total-item">
            <div class="total-label">Líquido do Mês</div>
            <div class="total-value highlight">${formatCurrency(resumo.liquidoMes)}</div>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }, [resumo, mesSelecionado]);

  if (!resumo) {
    return null;
  }

  const items = [
    { label: 'Quantidade de Horas', value: resumo.quantidadeHoras },
    { label: 'Cálculo DSR', value: resumo.calculoDsr },
    { label: 'Periculosidade', value: resumo.periculosidade },
    { label: 'Alimentação', value: resumo.alimentacao },
    { label: 'Férias', value: resumo.ferias },
    { label: 'Terço das Férias', value: resumo.tercoFerias },
    { label: '13º Salário', value: resumo.decimoTerceiro },
    { label: 'INSS Total', value: resumo.inssTotal, isDeduction: true },
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden gold-glow-hover shadow-card">
      <div className="px-4 py-3 bg-primary/10 border-b border-primary/20 flex items-center gap-3 flex-wrap">
        <Calendar className="w-5 h-5 text-primary" />
        <h3 className="font-display text-xl text-foreground tracking-wide">
          RESUMO DO MÊS
          {mesSelecionado && (
            <span className="text-primary ml-2">
              — {formatMonthYear(mesSelecionado).toUpperCase()}
            </span>
          )}
        </h3>
        <span className="text-sm text-muted-foreground">
          {resumo.count} convocação(ões)
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="w-4 h-4 mr-1" />
            Copiar
          </Button>
          <Button variant="gold" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="p-4">
        {/* Detalhamento por convocação */}
        {detalhes.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs uppercase text-muted-foreground tracking-wide mb-2">
              Detalhamento por Convocação
            </h4>
            <div className="space-y-1 bg-muted/30 rounded-lg p-3 max-h-48 overflow-y-auto">
              {detalhes.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0"
                >
                  <span className="text-foreground-muted">
                    {d.dataConvocacao ? formatDate(d.dataConvocacao) : 'Sem data'}
                  </span>
                  <span className="text-foreground font-mono">
                    {d.horas}h × R$ {VALOR_HORA_FIXO.toFixed(2).replace('.', ',')} = {formatCurrency(d.valorDia)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {items.map((item) => (
            <div
              key={item.label}
              className={`result-micro-card ${item.isDeduction ? 'border-destructive/30' : ''}`}
            >
              <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">
                {item.label}
              </p>
              <p className={`text-sm font-semibold ${item.isDeduction ? 'text-destructive' : 'text-foreground'}`}>
                {item.isDeduction ? '- ' : ''}{formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Totals row */}
        <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-4 justify-end">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Proventos</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(resumo.totalProventos)}</p>
          </div>
          <div className="text-right pl-4 border-l border-primary/30">
            <p className="text-xs text-primary uppercase tracking-wide">Líquido do Mês</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(resumo.liquidoMes)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
