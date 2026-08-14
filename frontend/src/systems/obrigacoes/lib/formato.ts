import type { Departamento, Periodicidade, RegimeTributario, StatusEntrega } from '../types'

/** CNPJ é armazenado só com dígitos; a formatação é da UI. */
export function formatarCnpj(cnpj: string): string {
  const d = (cnpj || '').replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** Datas do Postgres chegam como 'YYYY-MM-DD'. Nada de `new Date(iso)` aqui:
 *  isso interpretaria como UTC e poderia recuar um dia no fuso do Brasil. */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** Competência é sempre o 1º dia do mês; a tela mostra MM/AAAA. */
export function formatarCompetencia(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m] = iso.slice(0, 10).split('-')
  return `${m}/${a}`
}

/** Diferença em dias entre hoje e uma data ISO, sem passar por fuso. */
export function diasAte(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const alvo = Date.UTC(a, m - 1, d)
  const agora = new Date()
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())
  return Math.round((alvo - hoje) / 86400000)
}

export function rotuloPrazo(iso: string, status: StatusEntrega): string {
  if (status === 'ENTREGUE') return 'entregue'
  if (status === 'DISPENSADA') return 'dispensada'
  const dias = diasAte(iso)
  if (dias < 0) return `${Math.abs(dias)}d em atraso`
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `em ${dias}d`
}

export const ROTULO_STATUS: Record<StatusEntrega, string> = {
  PENDENTE: 'Pendente',
  AGUARDANDO_CLIENTE: 'Aguardando cliente',
  EM_ANDAMENTO: 'Em andamento',
  ENTREGUE: 'Entregue',
  ATRASADA: 'Atrasada',
  DISPENSADA: 'Dispensada',
}

export const ROTULO_DEPARTAMENTO: Record<Departamento, string> = {
  FISCAL: 'Fiscal',
  CONTABIL: 'Contábil',
  PESSOAL: 'Pessoal',
}

export const ROTULO_REGIME: Record<RegimeTributario, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI',
  IMUNE_ISENTA: 'Imune/Isenta',
  TERCEIRO_SETOR: 'Terceiro Setor',
}

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  MENSAL: 'Mensal',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  QUADRIMESTRAL: 'Quadrimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
  EVENTUAL: 'Eventual',
}

/** Classes Tailwind do CRM (tokens @mg) por situação. */
export const CLASSE_STATUS: Record<StatusEntrega, string> = {
  ENTREGUE: 'bg-success-soft text-success',
  PENDENTE: 'bg-surface text-text-secondary',
  EM_ANDAMENTO: 'bg-info-soft text-info',
  AGUARDANDO_CLIENTE: 'bg-warning-soft text-warning',
  ATRASADA: 'bg-error-soft text-error',
  DISPENSADA: 'bg-surface text-text-muted',
}

/** Competência corrente no formato aceito pelas RPCs (1º dia do mês). */
export function competenciaAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function deslocarCompetencia(iso: string, meses: number): string {
  const [a, m] = iso.slice(0, 10).split('-').map(Number)
  const base = new Date(Date.UTC(a, m - 1 + meses, 1))
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-01`
}
