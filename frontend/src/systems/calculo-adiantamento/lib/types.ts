export type ConfidenceLevel = 'high' | 'review' | 'missing';

export type ValueOrigin = 'extracted' | 'manual';

export interface EmployeePayroll {
  id: string;
  nome: string;
  cpf: string;
  liquido: number;
  proventos: number;
  descAdiantamento: number;
  // Campos usados pela fórmula da Mecânica PE
  bruto: number;
  planoSaude: number;
  inss: number;
  irrf: number;
  // UX metadata
  confidence: ConfidenceLevel;
  selected: boolean;
  editedFields: Set<string>;
  fieldOrigins: Record<string, ValueOrigin>;
}

export interface EmployeeAdvance extends EmployeePayroll {
  valorAdiantamento: number;
}

export type ProcessingStep = 'idle' | 'reading' | 'analyzing' | 'structuring' | 'done' | 'error';

export type FilterMode = 'all' | 'edited';

export type RoundingMode = 'floor' | 'round' | 'ceil';

// Identificador da empresa/cliente cuja fórmula será aplicada
export type CompanyId = 'bahia' | 'pe';

// Modo de base de cálculo:
// - 'liquido': base = Líquido (Mecânica Bahia)
// - 'pe': base = Bruto − Plano de Saúde − INSS − IRRF (Mecânica PE)
export type BaseMode = 'liquido' | 'pe';

export interface Company {
  id: CompanyId;
  name: string;
  description: string;
  formula: string;
}

export const COMPANIES: Company[] = [
  {
    id: 'bahia',
    name: 'Mecânica Bahia',
    description: 'Adiantamento calculado sobre o valor líquido.',
    formula: 'Líquido × 40%',
  },
  {
    id: 'pe',
    name: 'Mecânica PE',
    description: 'Adiantamento calculado sobre o bruto descontando encargos.',
    formula: '(Bruto − Plano de Saúde − INSS − IRRF) × 40%',
  },
];

export interface CalcConfig {
  // Percentual aplicado sobre a base (ex.: 40 = 40%)
  percent: number;
  // Subtrair o Desc. Adiant. Salarial do Líquido antes do percentual (apenas baseMode 'liquido')
  subtractAdiantamento: boolean;
  // Modo de arredondamento do valor final
  rounding: RoundingMode;
  // Como a base de cálculo é determinada
  baseMode: BaseMode;
}

export const DEFAULT_CALC_CONFIG: CalcConfig = {
  percent: 40,
  subtractAdiantamento: false,
  rounding: 'floor',
  baseMode: 'liquido',
};

// Configuração padrão de cada empresa
export const COMPANY_DEFAULT_CONFIG: Record<CompanyId, CalcConfig> = {
  bahia: { percent: 40, subtractAdiantamento: false, rounding: 'floor', baseMode: 'liquido' },
  pe: { percent: 40, subtractAdiantamento: false, rounding: 'floor', baseMode: 'pe' },
};

export interface BatchSummaryData {
  totalColaboradores: number;
  totalLiquido: number;
  totalAdiantamentos: number;
  competencia: string;
  ajustesManuais: number;
}
