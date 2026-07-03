export type Perfil = 'ADMIN' | 'COORDENADOR' | 'ANALISTA' | 'ASSISTENTE' | 'VISUALIZADOR'
export type Setor = 'FISCAL' | 'CONTABIL' | 'DP' | 'SOCIETARIO' | 'DIRETORIA' | 'TI' | 'GERAL'
export type SetorSistema = 'DP' | 'CONTABIL' | 'FISCAL' | 'SOCIETARIO' | 'TI' | 'GERAL' | 'RESTRITO'
export type StatusTarefa = 'PENDENTE' | 'EM_PROCESSAMENTO' | 'AGUARDANDO_CLIENTE' | 'CONCLUIDO'
export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA'
export type RegimeTributario = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
export type CategoriaSistema = 'MAIN' | 'AUTOMATION'

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: Perfil
  setor: Setor
  ativo: boolean
  fotoPerfil?: string
  dataCriacao: string
}

export interface Notificacao {
  id: string
  usuario_id: string
  titulo: string
  mensagem: string
  lida: boolean
  data_criacao: string
}

export interface Cliente {
  id: string
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  regimeTributario: RegimeTributario
  statusCnpj: string
  contatoPrincipal: string
  telefoneWhatsapp?: string
  documentosExigidos?: string
  dataCriacao: string
  dataAtualizacao: string
}

export interface Documento {
  id: string
  clienteId: string
  nomeArquivo: string
  tamanhoBytes: number
  tipoMime: string
  caminhoStorage: string
  enviadoPor: 'CLIENTE' | 'USUARIO'
  status: 'PENDENTE' | 'RECEBIDO' | 'REJEITADO'
  dataEnvio: string
  competencia?: string
}

export interface Tarefa {
  id: string
  titulo: string
  descricao: string
  clienteId: string
  clienteNome?: string
  responsavelId: string
  responsavelNome?: string
  setorOrigem: Setor | string
  status: StatusTarefa
  prioridade: Prioridade
  dataVencimento: string
  dataConclusao?: string
  dataCriacao: string
}

export interface Sistema {
  id: string
  nome: string
  descricao: string
  slug: string
  categoria: CategoriaSistema
  setor?: SetorSistema
  url: string
  icone: string
  allowedOrigin: string
  ativo: boolean
}

export interface AuditLog {
  id: number
  dataHora: string
  usuarioId: string
  usuarioNome?: string
  acao: string
  alvo: string
  detalhes: Record<string, unknown>
}

export interface DashboardSummary {
  totalUsuarios: number
  usuariosAtivos: number
  totalSistemas: number
  tarefasAbertas: number
  tarefasVencidas: number
  recentAuditLogs: AuditLog[]
}

export interface AuthResponse {
  token: string
  usuario: Usuario
}

export interface PaginatedResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

export interface TaskFilters {
  status?: StatusTarefa
  setor?: Setor
  responsavelId?: string
  clienteId?: string
  prioridade?: Prioridade
}

export interface AuditFilters {
  usuarioId?: string
  acao?: string
  dataInicio?: string
  updated_at?: string
}

export interface SearchResultItem {
  id: string
  type: string
  title: string
  subtitle?: string
  url: string
  icon?: string
}

export interface SearchResponse {
  results: SearchResultItem[]
}
