import { CalendarDays } from 'lucide-react'
import { cn, dueMeta, formatDate, getInitials } from '@/lib/utils'
import { PRIORITY_COLORS, PRIORITY_LABELS, getSetorColors } from '@/lib/constants'
import type { Tarefa } from '@/types'

interface TaskCardProps {
  task: Tarefa
  isDragging: boolean
  onClick: () => void
  /** Nome do setor vindo da API, para setores cadastrados pelo admin. */
  setorLabel?: string
}

const DUE_TONE_CLASS = {
  error: 'text-error',
  warning: 'text-warning',
  neutral: 'text-text-secondary',
  muted: 'text-text-muted',
} as const

/**
 * Card do quadro. A composição responde a "posso pegar isso agora?" —
 * setor, prioridade, cliente, vencimento e responsável legíveis sem abrir a
 * tarefa. Cor aparece só onde significa algo: urgência e prioridade.
 */
export default function TaskCard({ task, isDragging, onClick, setorLabel }: TaskCardProps) {
  const priority = PRIORITY_COLORS[task.prioridade]
  const setor = getSetorColors(task.setorOrigem, setorLabel)
  const due = dueMeta(task.dataVencimento, task.status)

  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-lg border bg-card p-3.5 transition-all',
        isDragging
          ? 'border-gold shadow-lg shadow-gold/10 rotate-1'
          : 'border-border hover:border-border-light',
      )}
    >
      {/* Setor + prioridade */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex h-5 max-w-[60%] items-center truncate rounded px-1.5 text-[10px] font-semibold uppercase tracking-label',
            setor.bg,
            setor.text,
          )}
        >
          {setor.label}
        </span>
        <span className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[10px] font-medium', priority.bg, priority.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', priority.dot)} aria-hidden="true" />
          {PRIORITY_LABELS[task.prioridade]}
        </span>
      </div>

      <h4 className="line-clamp-2 text-[14px] font-medium leading-snug text-text-primary">
        {task.titulo}
      </h4>

      {task.clienteNome && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-text-secondary">
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-surface text-[8px] font-semibold text-text-muted"
          >
            {getInitials(task.clienteNome)}
          </span>
          <span className="truncate">{task.clienteNome}</span>
        </div>
      )}

      {/* Rodapé: vencimento + responsável */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <div className={cn('flex min-w-0 items-center gap-1.5 text-[12px]', DUE_TONE_CLASS[due.tone])}>
          <CalendarDays className="h-[13px] w-[13px] shrink-0" aria-hidden="true" />
          <span className="truncate">
            {formatDate(task.dataVencimento)}
            {due.label && ` · ${due.label}`}
          </span>
        </div>

        {task.responsavelNome && (
          <span
            title={task.responsavelNome}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-[9px] font-semibold text-text-secondary"
          >
            {getInitials(task.responsavelNome)}
          </span>
        )}
      </div>
    </div>
  )
}
