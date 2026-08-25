import React, { useState } from 'react';
import { Download, FileText, Table as TableIcon, Printer } from 'lucide-react';
import { DreNode } from './DRETable';

interface ExportButtonProps {
  dreData: DreNode[];
  companyName: string;
  targetPeriod: string;
  basePeriod?: string;
}

export default function ExportButton({ dreData, companyName, targetPeriod, basePeriod }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // ─── Flatten tree for CSV ───
  const flattenDreData = (nodes: DreNode[], depth = 0): Record<string, string>[] => {
    let result: Record<string, string>[] = [];
    nodes.forEach(node => {
      result.push({
        'Conta Contabil': ' '.repeat(depth * 4) + node.account_name,
        [`${targetPeriod} (R$)`]: node.value.toFixed(2).replace('.', ','),
        'AV Alvo (%)': node.percentage.toFixed(2).replace('.', ',') + '%',
        [`${basePeriod || 'Base'} (R$)`]: node.base_value.toFixed(2).replace('.', ','),
        'AV Base (%)': node.base_percentage.toFixed(2).replace('.', ',') + '%',
        'AH Variacao (%)': node.ah_percentage.toFixed(2).replace('.', ',') + '%',
      });
      if (node.children?.length) {
        result = result.concat(flattenDreData(node.children, depth + 1));
      }
    });
    return result;
  };

  // ─── CSV Export ───
  const exportCSV = () => {
    const flat = flattenDreData(dreData);
    if (!flat.length) return;
    const headers = Object.keys(flat[0]);
    const rows = flat.map(row => headers.map(h => `"${row[h]}"`).join(';'));
    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DRE_${companyName.replace(/\s+/g, '_')}_${targetPeriod.replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  // ─── Render DRE rows recursively as HTML string ───
  const renderRows = (nodes: DreNode[], depth = 0): string => {
    return nodes.map(node => {
      const indent = depth * 20;
      const isParent = depth === 0;
      const varColor = node.ah_percentage > 0 ? '#16a34a' : node.ah_percentage < 0 ? '#dc2626' : '#6b7280';
      const varSign = node.ah_percentage > 0 ? '+' : '';
      const rowBg = isParent ? '#1e1e20' : '#131315';
      const nameColor = isParent ? '#d4af37' : '#e4e4e7';
      const fontWeight = isParent ? '700' : '400';
      const children = node.children?.length ? renderRows(node.children, depth + 1) : '';

      return `
        <tr style="background:${rowBg}; border-bottom: 1px solid #27272a;">
          <td style="padding: 8px 12px; padding-left: ${12 + indent}px; color:${nameColor}; font-weight:${fontWeight}; font-size:13px;">
            ${node.account_name}
          </td>
          <td style="padding: 8px 12px; text-align:right; color:#ffffff; font-size:13px;">${fmt(node.value)}</td>
          <td style="padding: 8px 12px; text-align:right; color:#d4af37; font-size:12px;">${node.percentage.toFixed(2)}%</td>
          <td style="padding: 8px 12px; text-align:right; color:#9ca3af; font-size:13px;">${fmt(node.base_value)}</td>
          <td style="padding: 8px 12px; text-align:right; color:#6b7280; font-size:12px;">${node.base_percentage.toFixed(2)}%</td>
          <td style="padding: 8px 12px; text-align:right; color:${varColor}; font-weight:600; font-size:13px;">${varSign}${node.ah_percentage.toFixed(2)}%</td>
        </tr>
        ${children}
      `;
    }).join('');
  };

  // ─── PDF via print-ready HTML page in new window ───
  const exportPDF = () => {
    setLoading(true);
    setIsOpen(false);

    const rows = renderRows(dreData);
    const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório B.I — ${companyName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: #0c0c0c;
      color: #e4e4e7;
      padding: 32px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #27272a;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .header h1 { font-size: 24px; color: #ffffff; font-weight: 700; }
    .header h1 span { color: #d4af37; }
    .header .meta { text-align: right; color: #71717a; font-size: 12px; line-height: 1.8; }
    .badge {
      display: inline-block;
      background: #1a1a1c;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      color: #a1a1aa;
      margin-bottom: 8px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      border-radius: 8px;
      overflow: hidden;
    }
    thead tr {
      background: #0c0c0c;
      border-bottom: 1px solid #27272a;
    }
    thead th {
      padding: 10px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    thead th:not(:first-child) { text-align: right; }
    .footer {
      margin-top: 28px;
      border-top: 1px solid #27272a;
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #52525b;
    }
    @media print {
      body { padding: 16px; }
      @page { margin: 10mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="badge">Painel Executivo B.I</div>
      <h1>${companyName.split(' ').slice(0, -1).join(' ')} <span>${companyName.split(' ').slice(-1)[0]}</span></h1>
      <p style="color:#71717a; font-size:13px; margin-top:4px;">Demonstração do Resultado Analítica</p>
    </div>
    <div class="meta">
      <div>Período Alvo: <strong style="color:#ffffff">${targetPeriod}</strong></div>
      ${basePeriod ? `<div>Base de Comparação: <strong style="color:#ffffff">${basePeriod}</strong></div>` : ''}
      <div style="margin-top:4px;">Gerado em: ${now}</div>
    </div>
  </div>

  <div class="section-title">D.R.E. — Análise Vertical e Horizontal Comparativa</div>

  <table>
    <thead>
      <tr>
        <th>Conta Contábil</th>
        <th style="text-align:right; color:#ffffff">${targetPeriod}</th>
        <th style="text-align:right; color:#d4af37">AV% (Alvo)</th>
        <th style="text-align:right; color:#9ca3af">${basePeriod || 'Base'}</th>
        <th style="text-align:right; color:#6b7280">AV% (Base)</th>
        <th style="text-align:right">AH% (Variação)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>Mendonça Galvão — B.I Platform</span>
    <span>Relatório gerado automaticamente em ${now}</span>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 600);
    });
  </script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      alert('Popup bloqueado! Permita popups para este site e tente novamente.');
      setLoading(false);
      return;
    }
    win.document.write(html);
    win.document.close();
    setLoading(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#d4af37] text-black px-4 py-2 font-bold rounded-lg hover:bg-[#eacc59] transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)] disabled:opacity-60 text-sm"
        disabled={loading}
      >
        <Download size={16} />
        Exportar
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 mt-2 bg-[#1a1a1c] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden min-w-[260px] z-50">
          <div className="px-4 py-2 bg-[#111111] border-b border-[#27272a]">
            <span className="text-xs uppercase font-bold tracking-widest text-[#a1a1aa]">Exportar Relatório</span>
          </div>

          <button
            onClick={exportPDF}
            className="w-full text-left px-4 py-3 text-white hover:bg-[#27272a] transition-colors flex items-center gap-3 border-b border-[#27272a] focus:outline-none"
          >
            <div className="bg-[#d4af37]/10 p-2 rounded-md flex-shrink-0">
              <Printer size={18} className="text-[#d4af37]" />
            </div>
            <div>
              <p className="font-semibold text-sm">DRE Completa (PDF)</p>
              <p className="text-xs text-[#a1a1aa]">Abre para imprimir ou salvar</p>
            </div>
          </button>

          <button
            onClick={exportCSV}
            className="w-full text-left px-4 py-3 text-white hover:bg-[#27272a] transition-colors flex items-center gap-3 focus:outline-none"
          >
            <div className="bg-emerald-500/10 p-2 rounded-md flex-shrink-0">
              <TableIcon size={18} className="text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-sm">Dados da DRE (Excel/CSV)</p>
              <p className="text-xs text-[#a1a1aa]">Planilha com hierarquia completa</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
