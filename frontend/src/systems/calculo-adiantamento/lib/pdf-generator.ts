import { jsPDF } from 'jspdf';
import type { EmployeeAdvance, CalcConfig } from './types';
import { DEFAULT_CALC_CONFIG } from './types';
import { formatCurrency, formatCPF, formatPercent, calcBase } from './payroll-calc';

const PAGE_W = 210;
const MARGIN_L = 15;
const MARGIN_R = 15;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

function drawHeader(doc: jsPDF, competencia: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('JERONYMO DIXNEUF PEÇAS E SERVIÇOS LTDA', MARGIN_L, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('CNPJ: 00.000.000/0001-00', MARGIN_L, y);
  y += 4;
  doc.text(`Competência: ${competencia}`, MARGIN_L, y);
  y += 4;
  doc.text('RECIBO DE ADIANTAMENTO SALARIAL', MARGIN_L, y);
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
  y += 5;
  return y;
}

function drawEmployee(doc: jsPDF, emp: EmployeeAdvance, y: number, config: CalcConfig): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(emp.nome, MARGIN_L, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`CPF: ${formatCPF(emp.cpf)}`, MARGIN_L, y);
  y += 6;

  const col1 = MARGIN_L;
  const col2 = MARGIN_L + CONTENT_W * 0.65;

  if (config.baseMode === 'pe') {
    doc.text('Bruto:', col1, y);
    doc.text(formatCurrency(emp.bruto), col2, y, { align: 'left' });
    y += 6;

    doc.text('(-) Plano de Saúde:', col1, y);
    doc.text(formatCurrency(emp.planoSaude), col2, y, { align: 'left' });
    y += 6;

    doc.text('(-) INSS:', col1, y);
    doc.text(formatCurrency(emp.inss), col2, y, { align: 'left' });
    y += 6;

    doc.text('(-) IRRF:', col1, y);
    doc.text(formatCurrency(emp.irrf), col2, y, { align: 'left' });
    y += 6;

    doc.text('Base de cálculo:', col1, y);
    doc.text(formatCurrency(calcBase(emp, config)), col2, y, { align: 'left' });
    y += 6;
  } else {
    doc.text('Líquido:', col1, y);
    doc.text(formatCurrency(emp.liquido), col2, y, { align: 'left' });
    y += 6;

    if (config.subtractAdiantamento) {
      doc.text('(-) Desc. Adiant. Salarial:', col1, y);
      doc.text(formatCurrency(emp.descAdiantamento), col2, y, { align: 'left' });
      y += 6;

      doc.text('Base de cálculo:', col1, y);
      doc.text(formatCurrency(calcBase(emp, config)), col2, y, { align: 'left' });
      y += 6;
    }
  }


  doc.setFont('helvetica', 'bold');
  doc.text(`Adiantamento Salarial (${formatPercent(config.percent)}):`, col1, y);
  doc.text(formatCurrency(emp.valorAdiantamento), col2, y, { align: 'left' });
  y += 4;

  doc.setLineWidth(0.15);
  doc.setDrawColor(180, 180, 180);
  doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
  doc.setDrawColor(0, 0, 0);
  y += 6;
  return y;
}

export function generateSingleReceiptPdf(employee: EmployeeAdvance, competencia: string, config: CalcConfig = DEFAULT_CALC_CONFIG): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 20;
  y = drawHeader(doc, competencia, y);
  drawEmployee(doc, employee, y, config);

  const safeName = employee.nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  doc.save(`recibo-${safeName}-${competencia.replace(/\//g, '-')}.pdf`);
}

export function generateReceiptsPdf(employees: EmployeeAdvance[], competencia: string, config: CalcConfig = DEFAULT_CALC_CONFIG): void {
  const doc = new jsPDF('p', 'mm', 'a4');

  let y = 20;
  y = drawHeader(doc, competencia, y);

  for (let i = 0; i < employees.length; i++) {
    if (y > 230) {
      doc.addPage();
      y = 20;
      y = drawHeader(doc, competencia, y);
    }
    y = drawEmployee(doc, employees[i], y, config);
  }

  if (y > 245) {
    doc.addPage();
    y = 20;
  }
  y += 4;
  doc.setLineWidth(0.5);
  doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
  y += 7;

  const totalLiquido = employees.reduce((s, e) => s + e.liquido, 0);
  const totalAdiantamento = employees.reduce((s, e) => s + e.valorAdiantamento, 0);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAIS GERAIS', MARGIN_L, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Líquido: ${formatCurrency(totalLiquido)}`, MARGIN_L, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total de Adiantamentos: ${formatCurrency(totalAdiantamento)}`, MARGIN_L, y);

  doc.save(`adiantamento-salarial-${competencia.replace(/\//g, '-')}.pdf`);
}
