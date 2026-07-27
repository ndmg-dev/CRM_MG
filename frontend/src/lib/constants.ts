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

export const STATUS_COLORS: Record<StatusTarefa, { bg: string; text: string; border: string }> = {
  PENDENTE: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
  EM_PROCESSAMENTO: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  AGUARDANDO_CLIENTE: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  CONCLUIDO: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/30',
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
