/** Tipos do módulo de Obrigações Acessórias. Espelham os enums do schema. */

export type Departamento = 'FISCAL' | 'CONTABIL' | 'PESSOAL'
export type Esfera = 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL' | 'INTERNA'
export type Periodicidade =
  | 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'QUADRIMESTRAL'
  | 'SEMESTRAL' | 'ANUAL' | 'EVENTUAL'
export type RegimeTributario =
  | 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
  | 'MEI' | 'IMUNE_ISENTA' | 'TERCEIRO_SETOR'
export type StatusEntrega =
  | 'PENDENTE' | 'AGUARDANDO_CLIENTE' | 'EM_ANDAMENTO'
  | 'ENTREGUE' | 'ATRASADA' | 'DISPENSADA'
export type OrigemVinculo = 'REGIME' | 'GRUPO' | 'MANUAL'
export type OrigemBaixa = 'MANUAL' | 'AUTOMATICA_RECIBO'
export type MotivoRevisao =
  | 'empresa_nao_encontrada' | 'entrega_nao_parametrizada'
  | 'dados_ilegiveis' | 'multiplas_entregas'

/**
 * Perímetro da sessão. Vem do claim `perimetro` do JWT, nunca de rota ou
 * estado local — é o que separa o escritório do portal do cliente.
 */
export type Perimetro = 'COLABORADOR' | 'CLIENTE'

export interface SessaoObrigacoes {
  perimetro: Perimetro
  tenantId: string
  /** Só existe no perímetro CLIENTE. */
  empresaId?: string
  papel: string
  departamentos: Departamento[]
}

export interface Empresa {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  regime: RegimeTributario
  uf: string | null
  codigo_municipio: string | null
  responsavel_id: string | null
  ativa: boolean
}

export interface Obrigacao {
  id: string
  codigo: string
  nome: string
  descricao: string | null
  departamento: Departamento
  esfera: Esfera
  periodicidade: Periodicidade
  uf: string | null
  ativa: boolean
}

export interface EntregaLinha {
  id: string
  competencia: string
  vencimento: string
  status: StatusEntrega
  origem_baixa: OrigemBaixa | null
  anexo_nome: string | null
  empresa: { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string } | null
  obrigacao: { id: string; codigo: string; nome: string; departamento: Departamento } | null
  responsavel: { id: string; nome: string } | null
}

export interface PainelResumo {
  total: number
  entregues: number
  pendentes: number
  atrasadas: number
  aguardando_cliente: number
  vencendo_3_dias: number
}

export interface CargaResponsavel {
  responsavel_id: string | null
  responsavel: string
  total: number
  pendentes: number
  atrasadas: number
}

export interface ProximoVencimento {
  entrega_id: string
  empresa: string
  obrigacao: string
  departamento: Departamento
  competencia: string
  vencimento: string
  dias_restantes: number
  status: StatusEntrega
  responsavel: string | null
}

export interface EmpresaSituacao {
  empresa_id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  regime: RegimeTributario
  responsavel: string | null
  total: number
  entregues: number
  atrasadas: number
}

export interface DiaAgenda {
  dia: string
  total: number
  atrasadas: number
  entregues: number
}

export interface ItemRevisao {
  id: string
  hash_arquivo: string
  storage_path: string
  motivo: MotivoRevisao
  cnpj_lido: string | null
  codigo_obrigacao_lido: string | null
  competencia_lida: string | null
  status: 'ABERTO' | 'RESOLVIDO' | 'DESCARTADO'
  criado_em: string
}

export interface VinculoParametrizacao {
  id: string
  empresa_id: string
  obrigacao_id: string
  origem: OrigemVinculo
  origem_ref: string | null
  inicio: string
  fim: string | null
  ativa: boolean
  obrigacao: { codigo: string; nome: string; departamento: Departamento } | null
  responsavel: { id: string; nome: string } | null
}
