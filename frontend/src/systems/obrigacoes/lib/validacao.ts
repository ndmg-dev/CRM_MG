/**
 * Validação de formulário.
 *
 * Espelha as constraints do banco (migration 202608040013_validacao.sql).
 * Isto aqui é para dar erro legível antes do round-trip — a garantia continua
 * sendo a do banco, que vale também para quem chamar o PostgREST direto.
 */

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const PESOS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

export function somenteDigitos(v: string): string {
  return (v ?? '').replace(/\D/g, '')
}

function digito(base: string, pesos: number[]): number {
  const soma = base.split('').reduce((acc, c, i) => acc + Number(c) * pesos[i], 0)
  const r = soma % 11
  return r < 2 ? 0 : 11 - r
}

/** Confere os dois dígitos verificadores do CNPJ. */
export function cnpjValido(entrada: string): boolean {
  const d = somenteDigitos(entrada)
  if (d.length !== 14) return false
  // Sequências repetidas passam no cálculo mas não existem.
  if (/^(\d)\1{13}$/.test(d)) return false
  return Number(d[12]) === digito(d.slice(0, 12), PESOS_1)
      && Number(d[13]) === digito(d.slice(0, 13), PESOS_2)
}

/** Máscara progressiva, aplicada enquanto o usuário digita. */
export function mascararCnpj(entrada: string): string {
  const d = somenteDigitos(entrada).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export type ErrosFormulario = Record<string, string>

export interface DadosEmpresa {
  razao_social: string
  nome_fantasia: string
  cnpj: string
  regime: string
  uf: string
  codigo_municipio: string
  responsavel_id: string
}

export function validarEmpresa(d: DadosEmpresa): ErrosFormulario {
  const e: ErrosFormulario = {}

  const razao = d.razao_social.trim()
  if (razao.length < 2) e.razao_social = 'Informe a razão social (mínimo 2 caracteres).'
  else if (razao.length > 255) e.razao_social = 'Razão social acima de 255 caracteres.'

  if (d.nome_fantasia.trim().length > 150) e.nome_fantasia = 'Nome fantasia acima de 150 caracteres.'

  if (!somenteDigitos(d.cnpj)) e.cnpj = 'Informe o CNPJ.'
  else if (somenteDigitos(d.cnpj).length !== 14) e.cnpj = 'O CNPJ deve ter 14 dígitos.'
  else if (!cnpjValido(d.cnpj)) e.cnpj = 'CNPJ inválido — confira os dígitos verificadores.'

  if (!d.regime) e.regime = 'Selecione o regime tributário.'

  if (d.uf && !UFS.includes(d.uf.toUpperCase() as (typeof UFS)[number])) {
    e.uf = 'UF inválida.'
  }

  // Código IBGE do município: 7 dígitos. Necessário para o feriado municipal
  // entrar no cálculo de prazo — sem ele, a empresa só recebe nacional/estadual.
  if (d.codigo_municipio && !/^\d{7}$/.test(d.codigo_municipio.trim())) {
    e.codigo_municipio = 'O código IBGE do município tem 7 dígitos.'
  }

  return e
}

export interface DadosObrigacao {
  codigo: string
  nome: string
  descricao: string
  departamento: string
  esfera: string
  periodicidade: string
  uf: string
  codigo_municipio: string
  // regra de prazo
  tipo_dia: string
  dia_base: string
  referencia: string
  ajuste: string
  sabado_e_util: boolean
  vigencia_inicio: string
}

export function validarObrigacao(d: DadosObrigacao, exigePrazo: boolean): ErrosFormulario {
  const e: ErrosFormulario = {}

  const codigo = d.codigo.trim().toUpperCase()
  if (!codigo) e.codigo = 'Informe o código.'
  else if (!/^[A-Z0-9_]{2,30}$/.test(codigo)) {
    e.codigo = 'Use apenas letras, números e underscore (2 a 30 caracteres).'
  }

  const nome = d.nome.trim()
  if (nome.length < 2) e.nome = 'Informe o nome da obrigação.'
  else if (nome.length > 150) e.nome = 'Nome acima de 150 caracteres.'

  if (d.descricao.length > 2000) e.descricao = 'Descrição acima de 2000 caracteres.'

  if (!d.departamento) e.departamento = 'Selecione o departamento.'
  if (!d.esfera) e.esfera = 'Selecione a esfera.'
  if (!d.periodicidade) e.periodicidade = 'Selecione a periodicidade.'

  // O schema exige coerência entre esfera e escopo geográfico.
  if (d.esfera === 'ESTADUAL' && !d.uf) e.uf = 'Obrigação estadual precisa de UF.'
  if (d.esfera === 'MUNICIPAL' && !/^\d{7}$/.test(d.codigo_municipio.trim())) {
    e.codigo_municipio = 'Obrigação municipal precisa do código IBGE (7 dígitos).'
  }
  if ((d.esfera === 'FEDERAL' || d.esfera === 'INTERNA') && d.uf) {
    e.uf = 'Obrigação federal ou interna não leva UF.'
  }

  if (exigePrazo) {
    const dia = Number(d.dia_base)
    if (!d.dia_base || !Number.isInteger(dia) || dia < 1 || dia > 31) {
      e.dia_base = 'O dia base vai de 1 a 31.'
    }
    if (!d.tipo_dia) e.tipo_dia = 'Selecione a contagem (dia útil ou corrido).'
    if (!d.referencia) e.referencia = 'Selecione o mês de referência.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.vigencia_inicio)) {
      e.vigencia_inicio = 'Informe a data de início da vigência.'
    }
  }

  return e
}

export function temErro(e: ErrosFormulario): boolean {
  return Object.keys(e).length > 0
}
