import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarDays, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, dueMeta, formatDate, formatDateTime } from '@/lib/utils'
import {
  KANBAN_COLUMNS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  getSetorColors,
} from '@/lib/constants'
import type { StatusTarefa, Tarefa } from '@/types'

interface TaskDetailDrawerProps {
  task: Tarefa
  setorLabel?: string
  onClose: () => void
  onEdit: () => void
  onMoveStatus: (status: StatusTarefa) => void
  isMoving?: boolean
}

const DUE_TONE_CLASS = {
  error: 'bg-error-soft text-error',
  warning: 'bg-warning-soft text-warning',
  neutral: 'bg-surface text-text-secondary',
  muted: 'bg-surface text-text-muted',
} as const

/** Próximo status no fluxo do quadro; `null` quando já está no fim. */
function nextStatus(status: StatusTarefa): StatusTarefa | null {
  const i = KANBAN_COLUMNS.indexOf(status)
  return i >= 0 && i < KANBAN_COLUMNS.length - 1 ? KANBAN_COLUMNS[i + 1] : null
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="shrink-0 text-[12px] text-text-muted">{label}</span>
      <span className="min-w-0 text-right text-[13px] text-text-primary">{children}</span>
    </div>
  )
}

/**
 * Detalhe da tarefa em painel lateral. Substitui o modal de leitura: o quadro
 * continua visível ao lado, então dá para percorrer várias tarefas em sequência
 * sem perder o contexto da coluna.
 */
export default function TaskDetailDrawer({
  task,
  setorLabel,
  onClose,
  onEdit,
  onMoveStatus,
  isMoving,
}: TaskDetailDrawerProps) {
  const setor = getSetorColors(task.setorOrigem, setorLabel)
  const priority = PRIORITY_COLORS[task.prioridade]
  const status = STATUS_COLORS[task.status]
  const due = dueMeta(task.dataVencimento, task.status)
  const proximo = nextStatus(task.status)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/50"
      />

      <motion.aside
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        role="dialog"
        aria-label="Detalhe da tarefa"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-border bg-card shadow-overlay"
      >
        {/* Topo */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3.5">
          <span
            className={cn(
              'inline-flex h-5 items-center truncate rounded px-1.5 text-[10px] font-semibold uppercase tracking-label',
              setor.bg,
              setor.text,
            )}
          >
            {setor.label}
          </span>
          <span className="truncate text-[12px] text-text-muted">Detalhe da tarefa</span>
          <button
            onClick={onClose}
            aria-label="Fechar detalhe"
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h2 className="text-[17px] font-semibold leading-snug text-text-primary">{task.titulo}</h2>

          {task.descricao && (
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-text-secondary">
              {task.descricao}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium',
                DUE_TONE_CLASS[due.tone],
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDate(task.dataVencimento)}
              {due.label && ` · ${due.label}`}
            </span>
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium',
                priority.bg,
                priority.text,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', priority.dot)} aria-hidden="true" />
              {PRIORITY_LABELS[task.prioridade]}
            </span>
          </div>

          <div className="mt-5">
            <Row label="Cliente">{task.clienteNome || '—'}</Row>
            <Row label="Responsável">{task.responsavelNome || 'Não atribuído'}</Row>
            <Row label="Setor de origem">{setor.label}</Row>
            <Row label="Status">
              <span className={cn('inline-flex items-center gap-1.5', status.text)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} aria-hidden="true" />
                {STATUS_LABELS[task.status]}
              </span>
            </Row>
            <Row label="Vencimento">{formatDate(task.dataVencimento)}</Row>
            <Row label="Criada em">{formatDateTime(task.dataCriacao)}</Row>
            {task.dataConclusao && (
              <Row label="Concluída em">{formatDateTime(task.dataConclusao)}</Row>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-3.5">
          {proximo && (
            <Button
              className="flex-1"
              disabled={isMoving}
              onClick={() => onMoveStatus(proximo)}
            >
              <ArrowRight className="mr-1 h-4 w-4" />
              Mover para {STATUS_LABELS[proximo]}
            </Button>
          )}
          <Button variant="secondary" className={proximo ? '' : 'flex-1'} onClick={onEdit}>
            <Pencil className="mr-1 h-4 w-4" />
            Editar
          </Button>
        </div>
      </motion.aside>
    </>
  )
}
