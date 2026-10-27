// Espelho dos schemas de leitura do backend (app/schemas/extrato.py). Os
// valores monetários podem chegar como number ou string (Decimal do Pydantic),
// então os tipamos como `number | string` e normalizamos com Number() na
// formatação (ver lib/format.ts).

export type Money = number | string

export interface EmpresaResumo {
  clientId: string
  razaoSocial: string | null
  cnpj: string
  mesesProcessados: number[]
}

export interface DashboardExtratos {
  ano: number
  empresasComExtrato: number
  totalRetiradasAno: Money
  totalAportesAno: Money
  extratosNoMes: number
  pendencias: number
  empresas: EmpresaResumo[]
}

export interface SocioConsolidado {
  socio: string
  totalRetiradas: Money
  totalAportes: Money
  totalMovimentado: Money
  excedente: Money
  meses: number[]
}

export interface MesExtrato {
  mes: number
  driveUrl: string | null
  driveFileId: string | null
  sha256: string
}

export interface MovimentacaoItem {
  data: string | null
  mes: number
  socio: string
  cpf: string | null
  tipo: 'retirada' | 'aporte'
  valor: Money
  descricao: string | null
  nomeExtrato: string | null
  contraparte: string | null
  papel: string | null
  documento: string | null
  historico: string | null
  driveUrl: string | null
}

export interface EmpresaDetalhe {
  clientId: string
  razaoSocial: string | null
  cnpj: string | null
  ano: number
  limiteAnual: Money
  socios: SocioConsolidado[]
  meses: MesExtrato[]
  movimentacoes: MovimentacaoItem[]
}

export interface ClientePick {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
}

export interface VincularResult {
  vinculados: number
  anos: number[]
}

export interface NaoVinculado {
  id: string
  cnpj: string
  ano: number
  mes: number
  arquivoOrigem: string | null
  driveUrl: string | null
  processadoEm: string | null
}
