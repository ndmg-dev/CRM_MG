export interface Convencao {
  id: string;
  mesReferencia: string; // format: YYYY-MM
  dataConvocacao: string; // ISO date string
  horas: number;
  valorHora: number;
  nomeTrabalhador: string;
  cpfTrabalhador: string;
  empresaNome: string;
  empresaCnpj: string;
  cidade: string;
}

export interface ConvencaoCalculos {
  resultado1: number; // horas * valorHora
  resultado2: number; // DSR = resultado1 / 6
  resultado3: number; // Periculosidade = (resultado1 + resultado2) * 0.30
  resultado4: number; // Alimentação = (553.32 / 220) * horas
  resultado5: number; // Férias = (resultado1 + resultado2 + resultado3) / 12
  resultado6: number; // 1/3 Férias = resultado5 / 3
  resultado7: number; // 13º = (resultado1 + resultado2 + resultado3) / 12
  inss: number;       // 7.5% of (resultado1 + resultado2 + resultado3 + resultado5 + resultado6 + resultado7)
  totalProventos: number;
  totalDescontos: number;
  liquidoReceber: number;
}

export interface ConfiguracaoRecibo {
  empresaNome: string;
  empresaCnpj: string;
  valorHoraPadrao: number;
  cidade: string;
}

export const defaultConfig: ConfiguracaoRecibo = {
  empresaNome: "AERONORD SERVICOS LTDA",
  empresaCnpj: "",
  valorHoraPadrao: 9.00,
  cidade: "Petrolina",
};
