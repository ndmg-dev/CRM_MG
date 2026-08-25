// Cliente HTTP para a API JSON do ContAI_PRO (Flask, hospedado à parte —
// branch feat/api-json-crm-sso). Segue o mesmo padrão do FiscalMatch
// (ver src/systems/conciliacao-fiscal/lib/api.ts): a API do sistema
// embarcado exige o MESMO Bearer token de sessão emitido pelo CRM, então
// reaproveitamos o token gravado em localStorage pelo authStore do CRM
// (chave 'crm_token' — ver src/stores/authStore.ts) em vez de qualquer auth
// própria (Supabase etc. não se aplicam aqui).
//
// Todos os 7 endpoints hoje portados para JSON stateless são GET e devolvem
// sempre { ok: boolean, data: ... } no sucesso ou { ok: false, message, code }
// no erro (ex.: code "NO_EMPRESA" = 400, 401 para token ausente/inválido/
// domínio errado).
const API_BASE =
  import.meta.env.VITE_CONTAI_API_URL || 'https://contai.mendoncagalvao.com.br'

if (!import.meta.env.VITE_CONTAI_API_URL) {
  console.warn(
    '[contai] VITE_CONTAI_API_URL não configurada — usando fallback de desenvolvimento (https://contai.mendoncagalvao.com.br). Ver TODO em api/client.ts.'
  )
}

export class ContaiApiError extends Error {
  code?: string
  status: number
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ContaiApiError'
    this.status = status
    this.code = code
  }
}

type ContaiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string }

/** fetch() com a base da API do ContAI e o Bearer token do CRM já anexados. */
async function contaiRequest<T>(
  path: string,
  options?: { method?: string; params?: Record<string, string | undefined> }
): Promise<T> {
  const token = localStorage.getItem('crm_token')
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const query = new URLSearchParams()
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.set(k, v)
    })
  }
  const qs = query.toString()
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`

  let res: Response
  try {
    res = await fetch(url, { method: options?.method ?? 'GET', headers })
  } catch (e) {
    throw new ContaiApiError('Falha de rede ao contatar a API do ContAI.', 0)
  }

  let payload: ContaiEnvelope<T> | null = null
  try {
    payload = await res.json()
  } catch {
    // corpo não-JSON (ex.: erro de proxy/gateway)
  }

  if (!payload) {
    throw new ContaiApiError(`Erro ${res.status} ao comunicar com a API do ContAI.`, res.status)
  }

  if (!payload.ok) {
    // 401 aqui é tratado de forma INLINE pela UI (ver useContaiQuery) — não
    // há tela de login própria para este sistema embarcado, diferente do
    // restante do CRM (ver src/lib/api.ts), então NÃO redirecionamos.
    throw new ContaiApiError(payload.message || `Erro ${res.status}`, res.status, payload.code)
  }

  return payload.data
}

// ---------------------------------------------------------------------------
// Tipos dos payloads (ver contrato descrito na tarefa de migração)
// ---------------------------------------------------------------------------
export interface ContaiDashboard {
  pendentes: number
  documentos_mes: number
  lancamentos_total: number
}

export interface ContaiPlanoContaItem {
  id: string
  empresa_id: string
  codigo: string
  codigo_estrutural: string
  descricao: string
  tipo: string | null
  natureza: string | null
  nivel: number
  [key: string]: unknown
}

export interface ContaiDocumento {
  id: string
  empresa_id: string
  nome_original: string
  storage_path: string
  tipo: string
  status: string
  created_at: string
  [key: string]: unknown
}

export interface ContaiRegraConta {
  id: string
  codigo: string
  descricao: string
}

export interface ContaiRegra {
  id: string
  tipo_regra: string
  padrao: string
  prioridade: number
  conta_id: string
  plano_contas?: { codigo: string; descricao: string }
  [key: string]: unknown
}

export interface ContaiRegrasResponse {
  regras: ContaiRegra[]
  contas: ContaiRegraConta[]
}

export interface ContaiIntegracoes {
  empresa: { id: string; nome: string } | Record<string, never>
}

export interface ContaiConfiguracoes {
  user: { id: string; email: string; name: string; avatar?: string | null } | null
}

export interface ContaiLancamento {
  id: string
  historico?: string
  data_lancamento?: string
  valor?: number
  tipo_dc?: 'credito' | 'debito'
  origem?: string
  plano_contas?: { codigo_estrutural: string; descricao: string } | null
  [key: string]: unknown
}

export interface ContaiConciliacao {
  pendentes: ContaiLancamento[]
  report: Record<string, unknown> | null
  periodos: string[]
  periodo_ativo: string | null
}

export interface ContaiEmpresa {
  id: string
  nome: string
}

// ---------------------------------------------------------------------------
// Funções tipadas para os 7 endpoints + seletor de empresa
// ---------------------------------------------------------------------------
export const contaiApi = {
  getDashboard: (empresaId?: string) =>
    contaiRequest<ContaiDashboard>('/api/dashboard', { params: { empresa_id: empresaId } }),

  getPlanoContas: (empresaId?: string) =>
    contaiRequest<ContaiPlanoContaItem[]>('/api/plano-contas', { params: { empresa_id: empresaId } }),

  getDocumentos: (empresaId?: string) =>
    contaiRequest<ContaiDocumento[]>('/api/documentos', { params: { empresa_id: empresaId } }),

  getRegras: (empresaId?: string) =>
    contaiRequest<ContaiRegrasResponse>('/api/regras', { params: { empresa_id: empresaId } }),

  getIntegracoes: (empresaId?: string) =>
    contaiRequest<ContaiIntegracoes>('/api/integracoes', { params: { empresa_id: empresaId } }),

  getConfiguracoes: (empresaId?: string) =>
    contaiRequest<ContaiConfiguracoes>('/api/configuracoes', { params: { empresa_id: empresaId } }),

  getConciliacao: (empresaId?: string, periodo?: string) =>
    contaiRequest<ContaiConciliacao>('/api/conciliacao', { params: { empresa_id: empresaId, periodo } }),

  // Não fica sob /api/* (rota antiga, pré-migração) mas já usa o mesmo
  // login_required com suporte a Bearer, então funciona sem mudança no
  // backend. Não depende de sessão — é só uma consulta, então não precisa
  // de empresa_id nenhum.
  listEmpresas: () => contaiRequest<ContaiEmpresa[]>('/empresas/lista'),
}
