import type {
  StatusTarefa,
  Prioridade,
  Perfil,
  RegimeTributario,
  VisibilidadeSistemas,
} from '@/types'

// ---------------------------------------------------------------------------
// Status da Tarefa
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<StatusTarefa, string> = {
  PENDENTE: 'Pendente',
  EM_PROCESSAMENTO: 'Em Processamento',
  AGUARDANDO_CLIENTE: 'Aguardando Cliente',
  CONCLUIDO: 'Concluído',
}

export const STATUS_COLORS: Record<StatusTarefa, { bg: string; text: string; border: string; dot: string }> = {
  PENDENTE: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    dot: 'bg-yellow-400',
  },
  EM_PROCESSAMENTO: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
  },
  AGUARDANDO_CLIENTE: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    dot: 'bg-orange-400',
  },
  CONCLUIDO: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/30',
    dot: 'bg-green-400',
  },
}

/** Texto do estado vazio de cada coluna do quadro. */
export const STATUS_EMPTY_STATE: Record<StatusTarefa, { title: string; description: string; actionLabel: string }> = {
  PENDENTE: {
    title: 'Nenhuma tarefa pendente',
    description: 'Novas obrigações e demandas internas entram nesta coluna.',
    actionLabel: 'Nova tarefa',
  },
  EM_PROCESSAMENTO: {
    title: 'Nada em processamento',
    description: 'Arraste uma tarefa pendente para assumir o trabalho.',
    actionLabel: 'Ver pendentes',
  },
  AGUARDANDO_CLIENTE: {
    title: 'Sem pendência externa',
    description: 'Tarefas travadas por documento ou resposta do cliente ficam aqui.',
    actionLabel: 'Cobrar cliente',
  },
  CONCLUIDO: {
    title: 'Nada concluído ainda',
    description: 'O histórico completo fica na auditoria do setor.',
    actionLabel: 'Ver auditoria',
  },
}

// ---------------------------------------------------------------------------
// Prioridade
// ---------------------------------------------------------------------------

export const PRIORITY_LABELS: Record<Prioridade, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
}

export const PRIORITY_COLORS: Record<Prioridade, { bg: string; text: string; dot: string }> = {
  BAIXA: {
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    dot: 'bg-gray-400',
  },
  MEDIA: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  ALTA: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    dot: 'bg-orange-400',
  },
  CRITICA: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
}

// ---------------------------------------------------------------------------
// Setor
// ---------------------------------------------------------------------------

/**
 * Rótulos dos setores originais. Os setores agora vêm da API (`/setores`);
 * este mapa serve apenas de fallback para exibir códigos legados quando a
 * lista ainda não carregou. Use `formatSetor` em vez de indexar direto.
 */
export const SETOR_LABELS: Record<string, string> = {
  FISCAL: 'Fiscal',
  CONTABIL: 'Contábil',
  DP: 'Departamento Pessoal',
  SOCIETARIO: 'Societário',
  TI: 'Tecnologia (TI)',
  DIRETORIA: 'Diretoria',
  GERAL: 'Geral',
}

/** Cor padrão de um setor sem cor cadastrada. */
export const SETOR_COR_PADRAO = '#94a3b8'

export interface SetorColors {
  label: string
  /** Cor do texto do rótulo (cabeçalho de grupo, pill). */
  text: string
  /** Fundo translúcido da pill. */
  bg: string
  /** Cor sólida — marcador redondo do cabeçalho do submenu de sistemas. */
  dot: string
  /**
   * Hover translúcido na cor do setor. Precisa ser a classe literal: o
   * Tailwind varre o código-fonte, então `hover:${bg}` montado em runtime
   * nunca chega a gerar CSS.
   */
  hoverBg: string
  /** Item selecionado dentro do grupo (usado na navegação lateral). */
  activeClass: string
}

/**
 * Identidade visual por setor, compartilhada entre a navegação lateral e o
 * quadro de tarefas. Vive aqui — e não em cada componente — para que os dois
 * lugares nunca divirjam.
 *
 * Setores criados pelo admin não estão nesta lista; use `getSetorColors`,
 * que devolve o fallback neutro.
 */
export const SETOR_COLORS: Record<string, SetorColors> = {
  DP: { label: 'Dep. Pessoal', text: 'text-blue-400', bg: 'bg-blue-500/10', dot: 'bg-blue-400', hoverBg: 'hover:bg-blue-500/10', activeClass: 'bg-blue-500/10 text-blue-400 font-semibold' },
  CONTABIL: { label: 'Contábil', text: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400', hoverBg: 'hover:bg-emerald-500/10', activeClass: 'bg-emerald-500/10 text-emerald-400 font-semibold' },
  FISCAL: { label: 'Fiscal', text: 'text-orange-400', bg: 'bg-orange-500/10', dot: 'bg-orange-400', hoverBg: 'hover:bg-orange-500/10', activeClass: 'bg-orange-500/10 text-orange-400 font-semibold' },
  SOCIETARIO: { label: 'Societário', text: 'text-purple-400', bg: 'bg-purple-500/10', dot: 'bg-purple-400', hoverBg: 'hover:bg-purple-500/10', activeClass: 'bg-purple-500/10 text-purple-400 font-semibold' },
  TI: { label: 'Tecnologia (TI)', text: 'text-cyan-400', bg: 'bg-cyan-500/10', dot: 'bg-cyan-400', hoverBg: 'hover:bg-cyan-500/10', activeClass: 'bg-cyan-500/10 text-cyan-400 font-semibold' },
  GERAL: { label: 'Geral', text: 'text-text-muted', bg: 'bg-surface', dot: 'bg-text-muted', hoverBg: 'hover:bg-surface', activeClass: 'bg-gold/10 text-gold font-semibold' },
  RESTRITO: { label: 'Restrito', text: 'text-red-500', bg: 'bg-red-500/10', dot: 'bg-red-500', hoverBg: 'hover:bg-red-500/10', activeClass: 'bg-red-500/10 text-red-500 font-semibold' },
}

const SETOR_COLORS_FALLBACK: Omit<SetorColors, 'label'> = {
  text: 'text-text-muted',
  bg: 'bg-surface',
  dot: 'bg-text-muted',
  hoverBg: 'hover:bg-surface',
  activeClass: 'bg-gold/10 text-gold font-semibold',
}

/**
 * Cores de um setor. `labelFallback` cobre os setores cadastrados pelo admin,
 * cujo nome só existe na API.
 */
export function getSetorColors(codigo?: string | null, labelFallback?: string): SetorColors {
  if (codigo && SETOR_COLORS[codigo]) return SETOR_COLORS[codigo]
  return { label: labelFallback || codigo || 'Sem setor', ...SETOR_COLORS_FALLBACK }
}

// ---------------------------------------------------------------------------
// Visibilidade de sistemas por setor
// ---------------------------------------------------------------------------

export const VISIBILIDADE_LABELS: Record<VisibilidadeSistemas, string> = {
  PROPRIO: 'Próprio setor',
  TOTAL: 'Todos os sistemas',
  RESTRITO: 'Restrito',
  PERSONALIZADO: 'Personalizado',
}

export const VISIBILIDADE_DESCRICOES: Record<VisibilidadeSistemas, string> = {
  PROPRIO: 'Vê os sistemas do próprio setor e os marcados como Geral.',
  TOTAL: 'Vê todo o catálogo, exceto os sistemas restritos (só administradores).',
  RESTRITO: 'Não vê nada por padrão — apenas o que for liberado individualmente.',
  PERSONALIZADO: 'Próprio setor e Geral, mais os setores escolhidos abaixo.',
}

export function formatSetor(codigo?: string | null): string {
  if (!codigo) return 'Sem setor'
  return SETOR_LABELS[codigo] || codigo
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export const PERFIL_LABELS: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  COORDENADOR: 'Coordenador',
  ANALISTA: 'Analista',
  ASSISTENTE: 'Assistente',
  VISUALIZADOR: 'Visualizador',
}

// ---------------------------------------------------------------------------
// Regime Tributário
// ---------------------------------------------------------------------------

export const REGIME_LABELS: Record<RegimeTributario, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
}

// ---------------------------------------------------------------------------
// Kanban
// ---------------------------------------------------------------------------

export const KANBAN_COLUMNS: StatusTarefa[] = [
  'PENDENTE',
  'EM_PROCESSAMENTO',
  'AGUARDANDO_CLIENTE',
  'CONCLUIDO',
]
