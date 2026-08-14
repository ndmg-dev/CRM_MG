import { supabase } from '@adiantamento/integrations/supabase/client';
import type { EmployeePayroll, ConfidenceLevel } from './types';

interface RawEmployee {
  nome: string;
  cpf: string;
  liquido: number;
  proventos: number;
  descAdiantamento: number;
  bruto: number;
  planoSaude: number;
  inss: number;
  irrf: number;
}

function assessConfidence(raw: RawEmployee): ConfidenceLevel {
  if ((!raw.liquido || raw.liquido <= 0) && (!raw.bruto || raw.bruto <= 0)) return 'missing';
  if (!raw.cpf || raw.cpf.replace(/\D/g, '').length !== 11) return 'review';
  if (!raw.nome || raw.nome.trim().length < 3) return 'review';
  return 'high';
}

export async function processPayrollPdf(file: File): Promise<EmployeePayroll[]> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const pdfBase64 = btoa(binary);

  const { data, error } = await supabase.functions.invoke('process-payroll', {
    body: { pdfBase64 },
  });

  if (error) {
    throw new Error(error.message || 'Erro ao processar folha de pagamento');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  const rawList = data.employees as RawEmployee[];

  return rawList.map((raw, i): EmployeePayroll => {
    const origins: Record<string, 'extracted'> = {};
    if ((raw.liquido ?? 0) > 0) origins.liquido = 'extracted';
    if ((raw.proventos ?? 0) > 0) origins.proventos = 'extracted';
    if ((raw.descAdiantamento ?? 0) > 0) origins.descAdiantamento = 'extracted';
    if ((raw.bruto ?? 0) > 0) origins.bruto = 'extracted';
    if ((raw.planoSaude ?? 0) > 0) origins.planoSaude = 'extracted';
    if ((raw.inss ?? 0) > 0) origins.inss = 'extracted';
    if ((raw.irrf ?? 0) > 0) origins.irrf = 'extracted';

    return {
      id: String(i + 1),
      nome: raw.nome ?? '',
      cpf: raw.cpf ?? '',
      liquido: raw.liquido ?? 0,
      proventos: raw.proventos ?? 0,
      descAdiantamento: raw.descAdiantamento ?? 0,
      bruto: raw.bruto ?? 0,
      planoSaude: raw.planoSaude ?? 0,
      inss: raw.inss ?? 0,
      irrf: raw.irrf ?? 0,
      confidence: assessConfidence(raw),
      selected: false,
      editedFields: new Set(),
      fieldOrigins: origins,
    };
  });
}
