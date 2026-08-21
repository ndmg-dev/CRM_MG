/**
 * Mock Data & API — allows the frontend to run standalone without a backend.
 * All data here uses realistic Portuguese content for the accounting firm context.
 */

import type {
  AuthResponse,
  Usuario,
  Cliente,
  Tarefa,
  Sistema,
  AuditLog,
  DashboardSummary,
  PersonalDashboardSummary,
  PaginatedResponse,
  TaskFilters,
  AuditFilters,
  StatusTarefa,
  Documento,
  SetorRecord,
  UserSession,
  SystemUsageSummary,
  SystemAccessLog,
  Notificacao,
  Release,
  ReleaseCreate,
  SearchResponse,
  SearchResultItem,
} from '@/types'
import { sleep } from './utils'

// ---------------------------------------------------------------------------
// Mock Setores — espelha o seed de `setores` do backend
// ---------------------------------------------------------------------------
const mockSetores: SetorRecord[] = [
  { id: 's1', codigo: 'FISCAL', nome: 'Fiscal', cor: '#22d3ee', ativo: true, visibilidade_sistemas: 'PROPRIO', setores_visiveis: [], data_criacao: '2024-01-01T00:00:00', total_usuarios: 0 },
  { id: 's2', codigo: 'CONTABIL', nome: 'Contábil', cor: '#f87171', ativo: true, visibilidade_sistemas: 'PROPRIO', setores_visiveis: [], data_criacao: '2024-01-01T00:00:00', total_usuarios: 0 },
  { id: 's3', codigo: 'DP', nome: 'Departamento Pessoal', cor: '#f472b6', ativo: true, visibilidade_sistemas: 'PROPRIO', setores_visiveis: [], data_criacao: '2024-01-01T00:00:00', total_usuarios: 0 },
  { id: 's4', codigo: 'SOCIETARIO', nome: 'Societário', cor: '#a78bfa', ativo: true, visibilidade_sistemas: 'PROPRIO', setores_visiveis: [], data_criacao: '2024-01-01T00:00:00', total_usuarios: 0 },
  { id: 's5', codigo: 'DIRETORIA', nome: 'Diretoria', cor: '#fbbf24', ativo: true, visibilidade_sistemas: 'TOTAL', setores_visiveis: [], data_criacao: '2024-01-01T00:00:00', total_usuarios: 0 },
  { id: 's6', codigo: 'TI', nome: 'Tecnologia (TI)', cor: '#facc15', ativo: true, visibilidade_sistemas: 'TOTAL', setores_visiveis: [], data_criacao: '2024-01-01T00:00:00', total_usuarios: 0 },
  { id: 's7', codigo: 'GERAL', nome: 'Geral', cor: '#94a3b8', ativo: true, visibilidade_sistemas: 'PROPRIO', setores_visiveis: [], data_criacao: '2024-01-01T00:00:00', total_usuarios: 0 },
]

// ---------------------------------------------------------------------------
// Mock Users
// ---------------------------------------------------------------------------
const mockUsuarios: Usuario[] = [
  { id: 'u1', nome: 'Arthur Monteiro', email: 'arthur.monteiro@mendoncagalvao.com.br', perfil: 'ADMIN', setor: 'DIRETORIA', ativo: true, fotoPerfil: undefined, dataCriacao: '2024-01-15T10:00:00' },
  { id: 'u2', nome: 'Fernanda Lima', email: 'fernanda.lima@mendoncagalvao.com.br', perfil: 'COORDENADOR', setor: 'FISCAL', ativo: true, fotoPerfil: undefined, dataCriacao: '2024-02-10T09:00:00' },
  { id: 'u3', nome: 'Ricardo Santos', email: 'ricardo.santos@mendoncagalvao.com.br', perfil: 'ANALISTA', setor: 'CONTABIL', ativo: true, fotoPerfil: undefined, dataCriacao: '2024-03-05T11:00:00' },
  { id: 'u4', nome: 'Mariana Costa', email: 'mariana.costa@mendoncagalvao.com.br', perfil: 'ANALISTA', setor: 'DP', ativo: true, fotoPerfil: undefined, dataCriacao: '2024-03-20T14:00:00' },
  { id: 'u5', nome: 'Carlos Almeida', email: 'carlos.almeida@mendoncagalvao.com.br', perfil: 'ASSISTENTE', setor: 'SOCIETARIO', ativo: true, fotoPerfil: undefined, dataCriacao: '2024-04-01T08:00:00' },
  { id: 'u6', nome: 'Juliana Pereira', email: 'juliana.pereira@mendoncagalvao.com.br', perfil: 'ASSISTENTE', setor: 'FISCAL', ativo: false, fotoPerfil: undefined, dataCriacao: '2024-04-15T10:30:00' },
  { id: 'u7', nome: 'Pedro Henrique', email: 'pedro.henrique@mendoncagalvao.com.br', perfil: 'VISUALIZADOR', setor: 'CONTABIL', ativo: true, fotoPerfil: undefined, dataCriacao: '2024-05-10T13:00:00' },
]

// ---------------------------------------------------------------------------
// Mock Clients
// ---------------------------------------------------------------------------
const mockClientes: Cliente[] = [
  { id: 'c1', razaoSocial: 'Tech Solutions Ltda', nomeFantasia: 'TechSol', cnpj: '12345678000190', regimeTributario: 'SIMPLES_NACIONAL', statusCnpj: 'Ativa', contatoPrincipal: 'João Silva', dataCriacao: '2024-01-20T10:00:00', dataAtualizacao: '2024-06-01T15:00:00' },
  { id: 'c2', razaoSocial: 'Comércio ABC S.A.', nomeFantasia: 'ABC Store', cnpj: '98765432000155', regimeTributario: 'LUCRO_PRESUMIDO', statusCnpj: 'Ativa', contatoPrincipal: 'Maria Oliveira', dataCriacao: '2024-02-15T09:00:00', dataAtualizacao: '2024-05-20T11:00:00' },
  { id: 'c3', razaoSocial: 'Indústria Norte Eireli', nomeFantasia: 'Norte Industrial', cnpj: '11223344000177', regimeTributario: 'LUCRO_REAL', statusCnpj: 'Ativa', contatoPrincipal: 'Roberto Mendes', dataCriacao: '2024-03-10T14:00:00', dataAtualizacao: '2024-06-05T09:30:00' },
  { id: 'c4', razaoSocial: 'Restaurante Bom Sabor Ltda', nomeFantasia: 'Bom Sabor', cnpj: '55667788000133', regimeTributario: 'SIMPLES_NACIONAL', statusCnpj: 'Ativa', contatoPrincipal: 'Ana Paula', dataCriacao: '2024-04-01T08:00:00', dataAtualizacao: '2024-06-08T10:00:00' },
  { id: 'c5', razaoSocial: 'Construtora Horizonte S.A.', nomeFantasia: 'Horizonte', cnpj: '99887766000122', regimeTributario: 'LUCRO_REAL', statusCnpj: 'Ativa', contatoPrincipal: 'Fernando Gomes', dataCriacao: '2024-05-05T11:00:00', dataAtualizacao: '2024-06-07T16:00:00' },
  { id: 'c6', razaoSocial: 'Distribuidora Rápida ME', nomeFantasia: 'Rápida', cnpj: '44556677000199', regimeTributario: 'SIMPLES_NACIONAL', statusCnpj: 'Suspensa', contatoPrincipal: 'Cláudia Neves', dataCriacao: '2024-01-10T10:00:00', dataAtualizacao: '2024-04-15T09:00:00' },
]

// ---------------------------------------------------------------------------
// Mock Tasks
// ---------------------------------------------------------------------------
const mockTarefas: Tarefa[] = [
  { id: 't1', titulo: 'Entrega DCTF — Tech Solutions', descricao: 'Preparar e transmitir DCTF mensal referente a maio/2024', clienteId: 'c1', clienteNome: 'TechSol', responsavelId: 'u2', responsavelNome: 'Fernanda Lima', setorOrigem: 'FISCAL', status: 'PENDENTE', prioridade: 'ALTA', dataVencimento: '2024-06-20T23:59:00', dataCriacao: '2024-06-01T10:00:00' },
  { id: 't2', titulo: 'Folha de Pagamento — ABC Store', descricao: 'Processar folha de pagamento referente a junho/2024', clienteId: 'c2', clienteNome: 'ABC Store', responsavelId: 'u4', responsavelNome: 'Mariana Costa', setorOrigem: 'DP', status: 'EM_PROCESSAMENTO', prioridade: 'CRITICA', dataVencimento: '2024-06-15T23:59:00', dataCriacao: '2024-06-05T09:00:00' },
  { id: 't3', titulo: 'Conciliação Bancária — Norte Industrial', descricao: 'Realizar conciliação bancária dos últimos 3 meses', clienteId: 'c3', clienteNome: 'Norte Industrial', responsavelId: 'u3', responsavelNome: 'Ricardo Santos', setorOrigem: 'CONTABIL', status: 'AGUARDANDO_CLIENTE', prioridade: 'MEDIA', dataVencimento: '2024-06-25T23:59:00', dataCriacao: '2024-06-03T14:00:00' },
  { id: 't4', titulo: 'Alteração Contratual — Bom Sabor', descricao: 'Preparar documentação para alteração de endereço no contrato social', clienteId: 'c4', clienteNome: 'Bom Sabor', responsavelId: 'u5', responsavelNome: 'Carlos Almeida', setorOrigem: 'SOCIETARIO', status: 'PENDENTE', prioridade: 'BAIXA', dataVencimento: '2024-07-10T23:59:00', dataCriacao: '2024-06-08T08:00:00' },
  { id: 't5', titulo: 'IRPJ Trimestral — Horizonte', descricao: 'Calcular e transmitir IRPJ trimestral 2º trimestre 2024', clienteId: 'c5', clienteNome: 'Horizonte', responsavelId: 'u2', responsavelNome: 'Fernanda Lima', setorOrigem: 'FISCAL', status: 'PENDENTE', prioridade: 'CRITICA', dataVencimento: '2024-06-30T23:59:00', dataCriacao: '2024-06-01T10:00:00' },
  { id: 't6', titulo: 'Cálculo de Rescisão — Rápida', descricao: 'Calcular rescisão contratual de funcionário desligado', clienteId: 'c6', clienteNome: 'Rápida', responsavelId: 'u4', responsavelNome: 'Mariana Costa', setorOrigem: 'DP', status: 'CONCLUIDO', prioridade: 'ALTA', dataVencimento: '2024-06-10T23:59:00', dataConclusao: '2024-06-09T16:30:00', dataCriacao: '2024-06-05T11:00:00' },
  { id: 't7', titulo: 'Balancete Mensal — TechSol', descricao: 'Fechar balancete contábil referente a maio/2024', clienteId: 'c1', clienteNome: 'TechSol', responsavelId: 'u3', responsavelNome: 'Ricardo Santos', setorOrigem: 'CONTABIL', status: 'EM_PROCESSAMENTO', prioridade: 'MEDIA', dataVencimento: '2024-06-18T23:59:00', dataCriacao: '2024-06-02T09:00:00' },
  { id: 't8', titulo: 'Abertura de Empresa — Cliente Novo', descricao: 'Processar abertura de nova empresa — CNPJ e inscrições', clienteId: 'c2', clienteNome: 'ABC Store', responsavelId: 'u5', responsavelNome: 'Carlos Almeida', setorOrigem: 'SOCIETARIO', status: 'AGUARDANDO_CLIENTE', prioridade: 'MEDIA', dataVencimento: '2024-07-01T23:59:00', dataCriacao: '2024-06-04T14:00:00' },
]

// ---------------------------------------------------------------------------
// Mock Systems (14 tools)
// ---------------------------------------------------------------------------
const mockSistemas: Sistema[] = [
  { id: 's1', nome: 'Abertura de Empresa', descricao: 'Sistema para gerenciamento de processos de abertura e constituição de empresas', slug: 'abertura-empresa', categoria: 'MAIN', url: '#', icone: 'building-2', allowedOrigin: '', ativo: true },
  { id: 's2', nome: 'Cálculo Adiantamento', descricao: 'Ferramenta de cálculo de adiantamento salarial e décimo terceiro', slug: 'calculo-adiantamento', categoria: 'MAIN', url: '#', icone: 'calculator', allowedOrigin: '', ativo: true },
  { id: 's3', nome: 'Aeronord - Convocações & Recibos', descricao: 'Gestão de convocações e recibos para o cliente Aeronord', slug: 'aeronord', categoria: 'MAIN', url: '#', icone: 'plane', allowedOrigin: '', ativo: true },
  { id: 's4', nome: 'BIMG - Business Intelligence', descricao: 'Dashboards e relatórios de Business Intelligence para análise contábil', slug: 'bimg', categoria: 'MAIN', url: '#', icone: 'bar-chart-3', allowedOrigin: '', ativo: true },
  { id: 's5', nome: 'Calculadora de Rescisão', descricao: 'Cálculo completo de verbas rescisórias trabalhistas', slug: 'calculadora-rescisao', categoria: 'MAIN', url: '#', icone: 'receipt', allowedOrigin: '', ativo: true },
  { id: 's6', nome: 'Central de Suporte', descricao: 'Sistema de tickets e suporte técnico interno', slug: 'central-suporte', categoria: 'MAIN', url: '#', icone: 'headphones', allowedOrigin: '', ativo: true },
  { id: 's7', nome: 'Cláusula AI', descricao: 'Assistente de inteligência artificial para análise e geração de cláusulas contratuais', slug: 'clausula-ai', categoria: 'AUTOMATION', url: '#', icone: 'bot', allowedOrigin: '', ativo: true },
  { id: 's8', nome: 'ContAI', descricao: 'Assistente contábil com inteligência artificial para automação de lançamentos', slug: 'contai', categoria: 'AUTOMATION', url: '#', icone: 'sparkles', allowedOrigin: '', ativo: true },
  { id: 's9', nome: 'Copilot Contábil', descricao: 'Copiloto de IA para auxiliar nas rotinas contábeis diárias', slug: 'copilot-contabil', categoria: 'AUTOMATION', url: '#', icone: 'cpu', allowedOrigin: '', ativo: true },
  { id: 's10', nome: 'Agendamento de Férias', descricao: 'Sistema de gestão e agendamento de férias dos colaboradores', slug: 'agendamento-ferias', categoria: 'MAIN', url: '#', icone: 'calendar-check', allowedOrigin: '', ativo: true },
  { id: 's11', nome: 'Ouvidoria Interna (RH)', descricao: 'Canal de ouvidoria interna para questões de recursos humanos', slug: 'ouvidoria-rh', categoria: 'MAIN', url: '#', icone: 'message-circle', allowedOrigin: '', ativo: true },
  { id: 's12', nome: 'Processamento Ponto', descricao: 'Sistema de processamento e gestão de ponto eletrônico', slug: 'processamento-ponto', categoria: 'MAIN', url: '#', icone: 'clock', allowedOrigin: '', ativo: true },
  { id: 's13', nome: 'Portal do Colaborador', descricao: 'Portal self-service para colaboradores acessarem seus dados e documentos', slug: 'portal-colaborador', categoria: 'MAIN', url: '#', icone: 'user-circle', allowedOrigin: '', ativo: true },
  { id: 's14', nome: 'Sistema de Cálculo de Comissão', descricao: 'Cálculo automatizado de comissões sobre vendas e serviços', slug: 'calculo-comissao', categoria: 'AUTOMATION', url: '#', icone: 'percent', allowedOrigin: '', ativo: true },
]

// ---------------------------------------------------------------------------
// Mock Audit Logs
// ---------------------------------------------------------------------------
const mockAuditLogs: AuditLog[] = [
  { id: 1, dataHora: '2024-06-08T15:30:00', usuarioId: 'u1', usuarioNome: 'Arthur Monteiro', acao: 'GRANT_ACCESS', alvo: 'User:u5 → Sistema:ContAI', detalhes: { sistemaId: 's8', usuarioId: 'u5' } },
  { id: 2, dataHora: '2024-06-08T14:20:00', usuarioId: 'u1', usuarioNome: 'Arthur Monteiro', acao: 'UPDATE_USER_ROLE', alvo: 'User:u3', detalhes: { oldRole: 'ASSISTENTE', newRole: 'ANALISTA' } },
  { id: 3, dataHora: '2024-06-08T11:00:00', usuarioId: 'u2', usuarioNome: 'Fernanda Lima', acao: 'CREATE_TAREFA', alvo: 'Tarefa:t5', detalhes: { titulo: 'IRPJ Trimestral — Horizonte' } },
  { id: 4, dataHora: '2024-06-07T16:45:00', usuarioId: 'u4', usuarioNome: 'Mariana Costa', acao: 'UPDATE_TAREFA_STATUS', alvo: 'Tarefa:t6', detalhes: { oldStatus: 'EM_PROCESSAMENTO', newStatus: 'CONCLUIDO' } },
  { id: 5, dataHora: '2024-06-07T10:15:00', usuarioId: 'u1', usuarioNome: 'Arthur Monteiro', acao: 'CREATE_CLIENTE', alvo: 'Cliente:c5', detalhes: { razaoSocial: 'Construtora Horizonte S.A.' } },
  { id: 6, dataHora: '2024-06-06T09:00:00', usuarioId: 'u3', usuarioNome: 'Ricardo Santos', acao: 'LOGIN_SUCCESS', alvo: 'User:u3', detalhes: {} },
  { id: 7, dataHora: '2024-06-05T17:30:00', usuarioId: 'u1', usuarioNome: 'Arthur Monteiro', acao: 'REVOKE_ACCESS', alvo: 'User:u6 → Sistema:BIMG', detalhes: { sistemaId: 's4', usuarioId: 'u6' } },
  { id: 8, dataHora: '2024-06-05T14:00:00', usuarioId: 'u1', usuarioNome: 'Arthur Monteiro', acao: 'UPDATE_USER_STATUS', alvo: 'User:u6', detalhes: { oldStatus: true, newStatus: false } },
]

// ---------------------------------------------------------------------------
// Mutable state — allows mock CRUD to work within the session
// ---------------------------------------------------------------------------
let tarefas = [...mockTarefas]

// ---------------------------------------------------------------------------
// Mock Documentos
// ---------------------------------------------------------------------------
let mockDocumentos: Documento[] = [
  { id: 'd1', clienteId: 'c1', nomeArquivo: 'extrato_maio.pdf', tamanhoBytes: 154200, tipoMime: 'application/pdf', caminhoStorage: '/fake/path/extrato_maio.pdf', enviadoPor: 'CLIENTE', status: 'RECEBIDO', dataEnvio: '2024-06-05T10:30:00' },
  { id: 'd2', clienteId: 'c1', nomeArquivo: 'notas_fiscais_maio.zip', tamanhoBytes: 2048500, tipoMime: 'application/zip', caminhoStorage: '/fake/path/notas_fiscais_maio.zip', enviadoPor: 'CLIENTE', status: 'RECEBIDO', dataEnvio: '2024-06-06T14:20:00' },
]

// ---------------------------------------------------------------------------
// Mock Sessões / Tracking / Notificações
// ---------------------------------------------------------------------------
const mockSessoes: UserSession[] = [
  { id: 'ses1', usuarioId: 'u1', usuarioNome: 'Arthur Monteiro', usuarioEmail: 'arthur.monteiro@mendoncagalvao.com.br', usuarioPerfil: 'ADMIN', usuarioSetor: 'DIRETORIA', inicio: '2024-06-10T08:02:00', ultimaAtividade: '2024-06-10T11:45:00', ipAddress: '192.168.0.11', userAgent: 'Chrome/125 Windows', ativa: true },
  { id: 'ses2', usuarioId: 'u2', usuarioNome: 'Fernanda Lima', usuarioEmail: 'fernanda.lima@mendoncagalvao.com.br', usuarioPerfil: 'COORDENADOR', usuarioSetor: 'FISCAL', inicio: '2024-06-10T08:15:00', ultimaAtividade: '2024-06-10T11:40:00', ipAddress: '192.168.0.24', userAgent: 'Firefox/126 Windows', ativa: true },
  { id: 'ses3', usuarioId: 'u3', usuarioNome: 'Ricardo Santos', usuarioEmail: 'ricardo.santos@mendoncagalvao.com.br', usuarioPerfil: 'ANALISTA', usuarioSetor: 'CONTABIL', inicio: '2024-06-09T09:00:00', ultimaAtividade: '2024-06-09T17:30:00', fim: '2024-06-09T17:31:00', ipAddress: '192.168.0.31', userAgent: 'Chrome/125 Windows', ativa: false },
]

const mockTopSistemas: SystemUsageSummary[] = [
  { sistemaId: 's1', sistemaNome: 'Abertura de Empresa', totalAcessos: 42, tempoTotalMinutos: 318 },
  { sistemaId: 's2', sistemaNome: 'Cálculo Adiantamento', totalAcessos: 27, tempoTotalMinutos: 154 },
  { sistemaId: 's3', sistemaNome: 'Aeronord - Convocações & Recibos', totalAcessos: 11, tempoTotalMinutos: 72 },
]

const mockAcessosRecentes: SystemAccessLog[] = [
  { id: 1, usuarioId: 'u1', usuarioNome: 'Arthur Monteiro', sistemaId: 's1', sistemaNome: 'Abertura de Empresa', inicio: '2024-06-10T10:12:00', fim: '2024-06-10T10:41:00', duracaoSegundos: 1740 },
  { id: 2, usuarioId: 'u2', usuarioNome: 'Fernanda Lima', sistemaId: 's2', sistemaNome: 'Cálculo Adiantamento', inicio: '2024-06-10T09:30:00', fim: '2024-06-10T09:52:00', duracaoSegundos: 1320 },
  { id: 3, usuarioId: 'u4', usuarioNome: 'Mariana Costa', sistemaId: 's1', sistemaNome: 'Abertura de Empresa', inicio: '2024-06-10T08:45:00', duracaoSegundos: undefined },
]

const mockNotificacoes: Notificacao[] = [
  { id: 'n1', usuario_id: 'u1', titulo: 'Tarefa vencida', mensagem: 'A tarefa "Fechamento contábil — Tech Solutions" passou do prazo.', lida: false, data_criacao: '2024-06-10T09:12:00' },
  { id: 'n2', usuario_id: 'u1', titulo: 'Novo documento recebido', mensagem: 'Comércio ABC S.A. enviou "notas_fiscais_maio.zip" pelo portal do cliente.', lida: false, data_criacao: '2024-06-10T08:40:00' },
  { id: 'n3', usuario_id: 'u1', titulo: 'Acesso concedido', mensagem: 'Ricardo Santos recebeu acesso ao sistema "Cálculo Adiantamento".', lida: true, data_criacao: '2024-06-09T16:05:00' },
]

// ---------------------------------------------------------------------------
// Mock API implementation
// ---------------------------------------------------------------------------
export const mockApi = {
  auth: {
    loginWithGoogle: async (_idToken: string): Promise<AuthResponse> => {
      await sleep(800)
      return { token: 'mock-jwt-token-for-demo', usuario: mockUsuarios[0] }
    },
    me: async (): Promise<Usuario> => {
      await sleep(300)
      return mockUsuarios[0]
    },
  },

  usuarios: {
    getAll: async (): Promise<Usuario[]> => {
      await sleep(400)
      return mockUsuarios
    },
    getById: async (id: string): Promise<Usuario> => {
      await sleep(300)
      const u = mockUsuarios.find((x) => x.id === id)
      if (!u) throw new Error('Usuário não encontrado')
      return u
    },
    update: async (id: string, data: Partial<Usuario>): Promise<Usuario> => {
      await sleep(500)
      const idx = mockUsuarios.findIndex((x) => x.id === id)
      if (idx === -1) throw new Error('Usuário não encontrado')
      if (data.email) {
        const email = data.email.trim().toLowerCase()
        if (mockUsuarios.some((x) => x.id !== id && x.email.toLowerCase() === email)) {
          throw new Error('E-mail já cadastrado')
        }
      }
      Object.assign(mockUsuarios[idx], data)
      return mockUsuarios[idx]
    },
    create: async (data: Partial<Usuario>): Promise<Usuario> => {
      await sleep(500)
      const email = (data.email || '').trim().toLowerCase()
      if (!email) throw new Error('E-mail é obrigatório')
      if (mockUsuarios.some((x) => x.email.toLowerCase() === email)) {
        throw new Error('E-mail já cadastrado')
      }
      if (data.setor && !mockSetores.some((s) => s.codigo === data.setor && s.ativo)) {
        throw new Error(`Setor '${data.setor}' não existe`)
      }
      const novo: Usuario = {
        id: `u${mockUsuarios.length + 1}`,
        nome: (data.nome || '').trim(),
        email,
        perfil: data.perfil || 'VISUALIZADOR',
        setor: data.setor ?? null,
        ativo: data.ativo ?? true,
        dataCriacao: new Date().toISOString(),
      }
      mockUsuarios.push(novo)
      return novo
    },
    delete: async (id: string): Promise<void> => {
      await sleep(400)
      const idx = mockUsuarios.findIndex((x) => x.id === id)
      if (idx === -1) throw new Error('Usuário não encontrado')
      mockUsuarios.splice(idx, 1)
    },
  },

  setores: {
    getAll: async (incluirInativos = false): Promise<SetorRecord[]> => {
      await sleep(300)
      const lista = incluirInativos ? mockSetores : mockSetores.filter((s) => s.ativo)
      return lista.map((s) => ({
        ...s,
        total_usuarios: mockUsuarios.filter((u) => u.setor === s.codigo).length,
      }))
    },
    create: async (data: Partial<SetorRecord>): Promise<SetorRecord> => {
      await sleep(400)
      const codigo = (data.codigo || '').trim().toUpperCase().replace(/ /g, '_')
      if (!codigo) throw new Error('Código é obrigatório')
      if (mockSetores.some((s) => s.codigo === codigo)) {
        throw new Error(`Já existe um setor com o código ${codigo}`)
      }
      const visibilidade = data.visibilidade_sistemas || 'PROPRIO'
      const visiveis = visibilidade === 'PERSONALIZADO' ? data.setores_visiveis || [] : []
      if (visibilidade === 'PERSONALIZADO' && !visiveis.length) {
        throw new Error('No modo Personalizado informe ao menos um setor visível')
      }
      const novo: SetorRecord = {
        id: `s${mockSetores.length + 1}`,
        codigo,
        nome: (data.nome || '').trim(),
        cor: data.cor ?? null,
        ativo: data.ativo ?? true,
        visibilidade_sistemas: visibilidade,
        setores_visiveis: visiveis,
        data_criacao: new Date().toISOString(),
        total_usuarios: 0,
      }
      mockSetores.push(novo)
      return novo
    },
    update: async (id: string, data: Partial<SetorRecord>): Promise<SetorRecord> => {
      await sleep(400)
      const idx = mockSetores.findIndex((s) => s.id === id)
      if (idx === -1) throw new Error('Setor não encontrado')
      const emUso = mockUsuarios.filter((u) => u.setor === mockSetores[idx].codigo).length
      if (data.ativo === false && emUso) {
        throw new Error(`Não é possível desativar: ${emUso} usuário(s) ainda vinculados`)
      }
      const modo = data.visibilidade_sistemas ?? mockSetores[idx].visibilidade_sistemas
      const visiveis =
        modo === 'PERSONALIZADO'
          ? data.setores_visiveis ?? mockSetores[idx].setores_visiveis
          : []
      if (modo === 'PERSONALIZADO' && !visiveis.length) {
        throw new Error('No modo Personalizado informe ao menos um setor visível')
      }
      // `codigo` é imutável, como no backend
      Object.assign(mockSetores[idx], {
        ...data,
        codigo: mockSetores[idx].codigo,
        visibilidade_sistemas: modo,
        setores_visiveis: visiveis,
      })
      return { ...mockSetores[idx], total_usuarios: emUso }
    },
    delete: async (id: string): Promise<void> => {
      await sleep(400)
      const idx = mockSetores.findIndex((s) => s.id === id)
      if (idx === -1) throw new Error('Setor não encontrado')
      const emUso = mockUsuarios.filter((u) => u.setor === mockSetores[idx].codigo).length
      if (emUso) {
        throw new Error(
          `Não é possível excluir: ${emUso} usuário(s) ainda vinculados a este setor`
        )
      }
      const referenciado = mockSetores.filter(
        (s) => s.id !== id && s.setores_visiveis.includes(mockSetores[idx].codigo)
      )
      if (referenciado.length) {
        throw new Error(
          `Não é possível excluir: ${referenciado.map((s) => s.nome).join(', ')} têm ` +
            'visibilidade sobre os sistemas deste setor'
        )
      }
      mockSetores.splice(idx, 1)
    },
  },

  clientes: {
    getAll: async (search?: string, page = 0, _size = 20): Promise<PaginatedResponse<Cliente>> => {
      await sleep(400)
      let filtered = mockClientes
      if (search) {
        const q = search.toLowerCase()
        filtered = mockClientes.filter(
          (c) =>
            c.razaoSocial.toLowerCase().includes(q) ||
            c.nomeFantasia.toLowerCase().includes(q) ||
            c.cnpj.includes(q),
        )
      }
      return {
        content: filtered,
        totalElements: filtered.length,
        totalPages: 1,
        page,
        size: 20,
      }
    },
    getById: async (id: string): Promise<Cliente> => {
      await sleep(300)
      const c = mockClientes.find((x) => x.id === id)
      if (!c) throw new Error('Cliente não encontrado')
      return c
    },
    create: async (data: Partial<Cliente>): Promise<Cliente> => {
      await sleep(600)
      const newCliente: Cliente = {
        id: `c${mockClientes.length + 1}`,
        razaoSocial: data.razaoSocial || '',
        nomeFantasia: data.nomeFantasia || '',
        cnpj: data.cnpj || '',
        regimeTributario: data.regimeTributario || 'SIMPLES_NACIONAL',
        statusCnpj: data.statusCnpj || 'Ativa',
        contatoPrincipal: data.contatoPrincipal || '',
        dataCriacao: new Date().toISOString(),
        dataAtualizacao: new Date().toISOString(),
      }
      mockClientes.push(newCliente)
      return newCliente
    },
    update: async (id: string, data: Partial<Cliente>): Promise<Cliente> => {
      await sleep(500)
      const idx = mockClientes.findIndex((x) => x.id === id)
      if (idx === -1) throw new Error('Cliente não encontrado')
      Object.assign(mockClientes[idx], data, { dataAtualizacao: new Date().toISOString() })
      return mockClientes[idx]
    },
    getDocuments: async (id: string): Promise<Documento[]> => {
      await sleep(300)
      return mockDocumentos.filter((d) => d.clienteId === id)
    },
    notifyPending: async (id: string): Promise<{ message: string; portal_url: string }> => {
      await sleep(600)
      const c = mockClientes.find((x) => x.id === id)
      if (!c) throw new Error('Cliente não encontrado')
      return { message: 'Notificação simulada enviada', portal_url: 'http://localhost:3000/portal/mock-token-123' }
    },
  },

  tarefas: {
    getAll: async (filters?: TaskFilters): Promise<Tarefa[]> => {
      await sleep(400)
      let result = [...tarefas]
      if (filters?.status) result = result.filter((t) => t.status === filters.status)
      if (filters?.setor) result = result.filter((t) => t.setorOrigem === filters.setor)
      if (filters?.responsavelId) result = result.filter((t) => t.responsavelId === filters.responsavelId)
      if (filters?.clienteId) result = result.filter((t) => t.clienteId === filters.clienteId)
      if (filters?.prioridade) result = result.filter((t) => t.prioridade === filters.prioridade)
      return result
    },
    getById: async (id: string): Promise<Tarefa> => {
      await sleep(300)
      const t = tarefas.find((x) => x.id === id)
      if (!t) throw new Error('Tarefa não encontrada')
      return t
    },
    create: async (data: Partial<Tarefa>): Promise<Tarefa> => {
      await sleep(600)
      const newTarefa: Tarefa = {
        id: `t${tarefas.length + 1}`,
        titulo: data.titulo || '',
        descricao: data.descricao || '',
        clienteId: data.clienteId || '',
        clienteNome: data.clienteNome || '',
        responsavelId: data.responsavelId || '',
        responsavelNome: data.responsavelNome || '',
        setorOrigem: data.setorOrigem || 'FISCAL',
        status: 'PENDENTE',
        prioridade: data.prioridade || 'MEDIA',
        dataVencimento: data.dataVencimento || new Date().toISOString(),
        dataCriacao: new Date().toISOString(),
      }
      tarefas.push(newTarefa)
      return newTarefa
    },
    update: async (id: string, data: Partial<Tarefa>): Promise<Tarefa> => {
      await sleep(500)
      const idx = tarefas.findIndex((x) => x.id === id)
      if (idx === -1) throw new Error('Tarefa não encontrada')
      Object.assign(tarefas[idx], data)
      return tarefas[idx]
    },
    updateStatus: async (id: string, status: StatusTarefa): Promise<Tarefa> => {
      await sleep(400)
      const idx = tarefas.findIndex((x) => x.id === id)
      if (idx === -1) throw new Error('Tarefa não encontrada')
      tarefas[idx].status = status
      if (status === 'CONCLUIDO') {
        tarefas[idx].dataConclusao = new Date().toISOString()
      }
      return tarefas[idx]
    },
  },

  sistemas: {
    getAll: async (): Promise<Sistema[]> => {
      await sleep(300)
      return mockSistemas
    },
    getByCategoria: async (cat: string): Promise<Sistema[]> => {
      await sleep(300)
      return mockSistemas.filter((s) => s.categoria === cat)
    },
  },

  acessos: {
    grant: async (_usuarioId: string, _sistemaId: string): Promise<void> => {
      await sleep(500)
    },
    revoke: async (_usuarioId: string, _sistemaId: string): Promise<void> => {
      await sleep(500)
    },
    getByUser: async (_userId: string): Promise<Sistema[]> => {
      await sleep(300)
      return mockSistemas
    },
  },

  auditoria: {
    getAll: async (filters?: AuditFilters): Promise<PaginatedResponse<AuditLog>> => {
      await sleep(400)
      let result = [...mockAuditLogs]
      if (filters?.acao) result = result.filter((l) => l.acao === filters.acao)
      if (filters?.usuarioId) result = result.filter((l) => l.usuarioId === filters.usuarioId)
      return {
        content: result,
        totalElements: result.length,
        totalPages: 1,
        page: 0,
        size: 20,
      }
    },
  },

  dashboard: {
    getSummary: async (): Promise<DashboardSummary> => {
      await sleep(500)
      return {
        totalUsuarios: mockUsuarios.length,
        usuariosAtivos: mockUsuarios.filter((u) => u.ativo).length,
        totalSistemas: mockSistemas.length,
        tarefasAbertas: tarefas.filter((t) => t.status !== 'CONCLUIDO').length,
        tarefasVencidas: 2,
        recentAuditLogs: mockAuditLogs.slice(0, 5),
      }
    },
    getPersonalSummary: async (): Promise<PersonalDashboardSummary> => {
      await sleep(500)
      const pendentes = tarefas.filter((t) => t.status !== 'CONCLUIDO')
      const deadlines = pendentes.slice(0, 3).map((t, i) => ({
        id: t.id,
        name: t.titulo,
        dueLabel: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : '3 dias',
      }))
      return {
        pendingTasks: pendentes.length,
        nextDeadlineLabel: deadlines[0]?.dueLabel ?? null,
        deadlines,
      }
    },
  },

  documentos: {
    downloadUrl: (id: string) => `#/download-mock/${id}`,
  },

  portal: {
    getInfo: async (token: string): Promise<any> => {
      await sleep(500)
      return {
        cliente_id: 'c1',
        razao_social: 'Tech Solutions Ltda',
        nome_fantasia: 'TechSol',
        cnpj: '12345678000190'
      }
    },
    upload: async (token: string, file: File): Promise<Documento> => {
      await sleep(1500)
      const newDoc: Documento = {
        id: `d${mockDocumentos.length + 1}`,
        clienteId: 'c1',
        nomeArquivo: file.name,
        tamanhoBytes: file.size,
        tipoMime: file.type,
        caminhoStorage: `/fake/path/${file.name}`,
        enviadoPor: 'CLIENTE',
        status: 'RECEBIDO',
        dataEnvio: new Date().toISOString()
      }
      mockDocumentos.push(newDoc)
      return newDoc
    }
  },

  // -------------------------------------------------------------------------
  // Namespaces abaixo existiam apenas no `realApi`. Sem eles, `api.sessoes`,
  // `api.notificacoes`, `api.search` e `api.tracking` ficavam `undefined` no
  // modo mock e `useHeartbeat`/`Header` derrubavam o shell autenticado.
  // -------------------------------------------------------------------------
  sessoes: {
    heartbeat: async (): Promise<void> => {
      await sleep(100)
    },
    getAtivas: async (): Promise<UserSession[]> => {
      await sleep(300)
      return mockSessoes.filter((s) => s.ativa)
    },
    getHistorico: async (
      filters?: { usuarioId?: string; dataInicio?: string; dataFim?: string },
      page = 0,
      size = 20,
    ): Promise<PaginatedResponse<UserSession>> => {
      await sleep(400)
      let result = [...mockSessoes]
      if (filters?.usuarioId) result = result.filter((s) => s.usuarioId === filters.usuarioId)
      return { content: result, totalElements: result.length, totalPages: 1, page, size }
    },
  },

  tracking: {
    // O id do sistema é ignorado no mock; a assinatura real é (sistemaId: string).
    entrar: async (): Promise<void> => {
      await sleep(100)
    },
    sair: async (): Promise<void> => {
      await sleep(100)
    },
    getResumo: async (): Promise<{ topSistemas: SystemUsageSummary[]; acessosRecentes: SystemAccessLog[] }> => {
      await sleep(400)
      return { topSistemas: mockTopSistemas, acessosRecentes: mockAcessosRecentes }
    },
  },

  notificacoes: {
    getAll: async (): Promise<Notificacao[]> => {
      await sleep(300)
      return mockNotificacoes
    },
    marcarComoLida: async (id: string): Promise<Notificacao> => {
      await sleep(200)
      const notif = mockNotificacoes.find((n) => n.id === id)
      if (!notif) throw new Error('Notificação não encontrada')
      notif.lida = true
      return notif
    },
  },

  releases: {
    getLatestUnread: async (): Promise<Release | null> => {
      await sleep(200)
      return null
    },
    getAll: async (): Promise<Release[]> => {
      await sleep(200)
      return []
    },
    marcarComoLida: async (): Promise<void> => {
      await sleep(150)
    },
    create: async (data: ReleaseCreate): Promise<Release> => {
      await sleep(300)
      return {
        id: 'mock-release',
        version: data.version,
        releasedAt: new Date().toISOString(),
        isRead: false,
        notes: data.notes.map((n, i) => ({ id: `mock-note-${i}`, sortOrder: i, systemName: n.system_name, description: n.description })),
      }
    },
    delete: async (): Promise<void> => {
      await sleep(150)
    },
  },

  search: {
    query: async (q: string): Promise<SearchResponse> => {
      await sleep(250)
      const term = q.trim().toLowerCase()
      if (term.length < 2) return { results: [] }

      const results: SearchResultItem[] = [
        ...mockSistemas
          .filter((s) => s.nome.toLowerCase().includes(term))
          .map((s) => ({
            id: s.id,
            type: 'sistema',
            title: s.nome,
            subtitle: s.descricao,
            url: `/sistemas/${s.id}`,
            icon: s.icone,
          })),
        ...mockClientes
          .filter(
            (c) =>
              c.razaoSocial.toLowerCase().includes(term) ||
              c.nomeFantasia.toLowerCase().includes(term) ||
              c.cnpj.includes(term),
          )
          .map((c) => ({
            id: c.id,
            type: 'cliente',
            title: c.razaoSocial,
            subtitle: c.nomeFantasia,
            url: `/clientes/${c.id}`,
            icon: 'building-2',
          })),
      ]

      return { results: results.slice(0, 8) }
    },
  },
}
