import { CalendarDays, User } from 'lucide-react'
import { cn, formatDate, isOverdue } from '@/lib/utils'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants'
import type { Tarefa } from '@/types'

interface TaskCardProps {
  task: Tarefa
  isDragging: boolean
  onClick: () => void
}

export default function TaskCard({ task, isDragging, onClick }: TaskCardProps) {
  const overdue = task.status !== 'CONCLUIDO' && isOverdue(task.dataVencimento)
  const priorityColor = PRIORITY_COLORS[task.prioridade]

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
      {/* Priority dot + title */}
      <div className="mb-2 flex items-start gap-2">
        <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', priorityColor.dot)} />
        <h4 className="text-sm font-medium text-text-primary leading-snug">{task.titulo}</h4>
      </div>

      {/* Client */}
      {task.clienteNome && (
        <span className="mb-2 inline-flex items-center rounded-md bg-surface-hover px-2 py-0.5 text-xs text-text-secondary">
          {task.clienteNome}
        </span>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        {/* Due date */}
        <div className={cn(
          'flex items-center gap-1 text-xs',
          overdue ? 'text-error' : 'text-text-muted',
        )}>
          <CalendarDays className="h-3 w-3" />
          {formatDate(task.dataVencimento)}
        </div>

        {/* Assignee + Priority */}
        <div className="flex items-center gap-2">
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', priorityColor.bg, priorityColor.text)}>
            {PRIORITY_LABELS[task.prioridade]}
          </span>
          {task.responsavelNome && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-hover" title={task.responsavelNome}>
              <User className="h-3 w-3 text-text-muted" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
