import { useMemo } from 'react'
import { Inbox } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import EmptyState from '@/components/common/EmptyState'
import { cn, dueMeta, formatDate, getInitials } from '@/lib/utils'
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  getSetorColors,
} from '@/lib/constants'
import type { Tarefa } from '@/types'

interface TaskListViewProps {
  tarefas: Tarefa[]
  nomeSetor: Record<string, string>
  onSelect: (task: Tarefa) => void
}

const DUE_TONE_CLASS = {
  error: 'text-error',
  warning: 'text-warning',
  neutral: 'text-text-secondary',
  muted: 'text-text-muted',
} as const

/** Triagem em massa: tudo em uma tabela, do vencimento mais próximo ao mais distante. */
export default function TaskListView({ tarefas, nomeSetor, onSelect }: TaskListViewProps) {
  const ordenadas = useMemo(
    () =>
      [...tarefas].sort(
        (a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime(),
      ),
    [tarefas],
  )

  if (ordenadas.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={Inbox}
          title="Nenhuma tarefa encontrada"
          description="Ajuste os filtros para ver outras tarefas."
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px]">Tarefa</TableHead>
            <TableHead className="text-[10px]">Cliente</TableHead>
            <TableHead className="text-[10px]">Setor</TableHead>
            <TableHead className="text-[10px]">Prioridade</TableHead>
            <TableHead className="text-[10px]">Vencimento</TableHead>
            <TableHead className="text-[10px]">Resp.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenadas.map((task) => {
            const setor = getSetorColors(task.setorOrigem, nomeSetor[task.setorOrigem])
            const priority = PRIORITY_COLORS[task.prioridade]
            const status = STATUS_COLORS[task.status]
            const due = dueMeta(task.dataVencimento, task.status)

            return (
              <TableRow
                key={task.id}
                onClick={() => onSelect(task)}
                className="cursor-pointer"
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('h-[7px] w-[7px] shrink-0 rounded-full', status.dot)}
                      title={STATUS_LABELS[task.status]}
                    />
                    <span className="truncate font-medium">{task.titulo}</span>
                  </div>
                </TableCell>
                <TableCell className="text-text-secondary">{task.clienteNome || '—'}</TableCell>
                <TableCell>
                  <span className={cn('inline-flex h-5 items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-label', setor.bg, setor.text)}>
                    {setor.label}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={cn('inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-medium', priority.bg, priority.text)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', priority.dot)} aria-hidden="true" />
                    {PRIORITY_LABELS[task.prioridade]}
                  </span>
                </TableCell>
                <TableCell className={cn('text-[12px]', DUE_TONE_CLASS[due.tone])}>
                  {formatDate(task.dataVencimento)}
                  {due.label && ` · ${due.label}`}
                </TableCell>
                <TableCell>
                  {task.responsavelNome ? (
                    <span
                      title={task.responsavelNome}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-[9px] font-semibold text-text-secondary"
                    >
                      {getInitials(task.responsavelNome)}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
