import { dueMeta, isDueSoon } from '@/lib/utils'
import type { Tarefa } from '@/types'

/**
 * Atalhos que vivem só no cliente. Nenhum deles cabe em `TaskFilters`:
 * vencimento não é campo da query e "alta e crítica" são duas prioridades,
 * enquanto o filtro do servidor aceita uma só.
 */
export interface QuickFilters {
  vencidas?: boolean
  proximas?: boolean
  minhas?: boolean
  altaCritica?: boolean
}

export function hasQuickFilters(quick: QuickFilters): boolean {
  return Object.values(quick).some(Boolean)
}

/** Tarefa aberta cujo prazo já passou. */
export function isTarefaVencida(tarefa: Tarefa): boolean {
  return tarefa.status !== 'CONCLUIDO' && dueMeta(tarefa.dataVencimento, tarefa.status).days < 0
}

/** Aplica os chips sobre a lista já filtrada pelo servidor. */
export function applyQuickFilters(
  tarefas: Tarefa[],
  quick: QuickFilters,
  userId?: string,
): Tarefa[] {
  return tarefas.filter((t) => {
    if (quick.vencidas && !isTarefaVencida(t)) return false
    if (quick.proximas && !(t.status !== 'CONCLUIDO' && isDueSoon(t.dataVencimento, 7))) return false
    if (quick.minhas && t.responsavelId !== userId) return false
    if (quick.altaCritica && t.prioridade !== 'ALTA' && t.prioridade !== 'CRITICA') return false
    return true
  })
}
