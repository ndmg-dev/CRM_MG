import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_LABELS } from '@/lib/constants'
import { hasQuickFilters, type QuickFilters } from '@/lib/taskFilters'
import type { Prioridade, Setor, TaskFilters, Usuario } from '@/types'

interface ChipProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  /** Chip de alerta: fica vermelho translúcido quando inativo e tem contagem. */
  alert?: boolean
}

function Chip({ active, onClick, children, alert }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors',
        active
          ? 'border-transparent bg-gold text-background'
          : alert
            ? 'border-error/35 bg-error-soft text-error hover:bg-error/20'
            : 'border-border bg-surface-raised text-text-secondary hover:border-border-light hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}

interface TaskFilterBarProps {
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  quick: QuickFilters
  onQuickChange: (quick: QuickFilters) => void
  setores: Array<{ id: string; codigo: string; nome: string }>
  usuarios: Usuario[]
  isAdmin: boolean
  /** Total vindo do servidor e total após os chips. */
  visibleCount: number
  totalCount: number
  overdueCount: number
}

export default function TaskFilterBar({
  filters,
  onFiltersChange,
  quick,
  onQuickChange,
  setores,
  usuarios,
  isAdmin,
  visibleCount,
  totalCount,
  overdueCount,
}: TaskFilterBarProps) {
  const selectClass =
    'h-8 rounded-md border border-border bg-surface-hover px-2.5 text-[12px] text-text-primary outline-none focus:border-gold'

  const toggle = (key: keyof QuickFilters) => onQuickChange({ ...quick, [key]: !quick[key] })

  const hasAny = Object.values(filters).some(Boolean) || hasQuickFilters(quick)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-4 space-y-3 rounded-xl border border-border bg-card p-4"
    >
      {/* Filtros do servidor */}
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <select
            aria-label="Filtrar por setor"
            className={selectClass}
            value={filters.setor || ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, setor: (e.target.value as Setor) || undefined })
            }
          >
            <option value="">Todos os setores</option>
            {setores.map((s) => (
              <option key={s.id} value={s.codigo}>{s.nome}</option>
            ))}
          </select>
        )}

        <select
          aria-label="Filtrar por prioridade"
          className={selectClass}
          value={filters.prioridade || ''}
          onChange={(e) =>
            onFiltersChange({ ...filters, prioridade: (e.target.value as Prioridade) || undefined })
          }
        >
          <option value="">Todas as prioridades</option>
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          aria-label="Filtrar por responsável"
          className={selectClass}
          value={filters.responsavelId || ''}
          onChange={(e) =>
            onFiltersChange({ ...filters, responsavelId: e.target.value || undefined })
          }
        >
          <option value="">Todos os responsáveis</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>

        <span className="ml-auto text-[12px] text-text-muted tabular-nums">
          {visibleCount} de {totalCount} tarefas
        </span>
      </div>

      {/* Atalhos */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Chip
          active={!!quick.vencidas}
          alert={overdueCount > 0}
          onClick={() => toggle('vencidas')}
        >
          Vencidas
          <span className="tabular-nums">{overdueCount}</span>
        </Chip>
        <Chip active={!!quick.proximas} onClick={() => toggle('proximas')}>
          Vencem em 7 dias
        </Chip>
        <Chip active={!!quick.minhas} onClick={() => toggle('minhas')}>
          Minhas tarefas
        </Chip>
        <Chip active={!!quick.altaCritica} onClick={() => toggle('altaCritica')}>
          Alta e crítica
        </Chip>

        {hasAny && (
          <button
            type="button"
            onClick={() => {
              onFiltersChange({})
              onQuickChange({})
            }}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-text-muted transition-colors hover:text-text-primary"
          >
            <X className="h-3 w-3" />
            Limpar
          </button>
        )}
      </div>
    </motion.div>
  )
}
