import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn, dueMeta } from '@/lib/utils'
import { getSetorColors } from '@/lib/constants'
import type { Tarefa } from '@/types'

interface TaskCalendarViewProps {
  tarefas: Tarefa[]
  nomeSetor: Record<string, string>
  onSelect: (task: Tarefa) => void
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Cor da barra lateral da faixa, pela urgência do vencimento. */
const DUE_BORDER_CLASS = {
  error: 'border-l-error',
  warning: 'border-l-warning',
  neutral: 'border-l-border-light',
  muted: 'border-l-border',
} as const

function parseVencimento(value: string): Date | null {
  try {
    const d = parseISO(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/** Primeiro nome do cliente — a faixa do calendário não comporta a razão social inteira. */
function primeiroNome(nome?: string): string {
  if (!nome) return 'Sem cliente'
  return nome.split(' ')[0]
}

/** Prazos do mês: onde a carga se concentra e o que estoura em seguida. */
export default function TaskCalendarView({ tarefas, nomeSetor, onSelect }: TaskCalendarViewProps) {
  const [mes, setMes] = useState(() => startOfMonth(new Date()))

  const dias = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(mes), { locale: ptBR }),
        end: endOfWeek(endOfMonth(mes), { locale: ptBR }),
      }),
    [mes],
  )

  // Uma passada só: agrupa as tarefas por dia do vencimento.
  const porDia = useMemo(() => {
    const mapa = new Map<string, Tarefa[]>()
    for (const t of tarefas) {
      const d = parseVencimento(t.dataVencimento)
      if (!d) continue
      const chave = format(d, 'yyyy-MM-dd')
      const lista = mapa.get(chave)
      if (lista) lista.push(t)
      else mapa.set(chave, [t])
    }
    return mapa
  }, [tarefas])

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[14px] font-semibold capitalize text-text-primary">
          {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMes((m) => addMonths(m, -1))}
            aria-label="Mês anterior"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMes((m) => addMonths(m, 1))}
            aria-label="Próximo mês"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border">
        {DIAS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-label text-text-muted">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const doMes = isSameMonth(dia, mes)
          const hoje = isToday(dia)
          const doDia = porDia.get(format(dia, 'yyyy-MM-dd')) || []

          return (
            <div
              key={dia.toISOString()}
              className={cn(
                'min-h-[98px] space-y-1 border-b border-r border-border p-1.5 last:border-r-0',
                !doMes && 'bg-sidebar/40',
              )}
            >
              <span
                className={cn(
                  'inline-block text-[11px] tabular-nums',
                  hoje ? 'font-bold text-gold' : doMes ? 'text-text-secondary' : 'text-text-disabled',
                )}
              >
                {format(dia, 'd')}
              </span>

              {doDia.map((t) => {
                const setor = getSetorColors(t.setorOrigem, nomeSetor[t.setorOrigem])
                const due = dueMeta(t.dataVencimento, t.status)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t)}
                    title={t.titulo}
                    className={cn(
                      'block w-full truncate rounded-sm border-l-2 bg-surface px-1.5 py-1 text-left text-[10px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary',
                      DUE_BORDER_CLASS[due.tone],
                    )}
                  >
                    <span className={setor.text}>{setor.label}</span>
                    {' · '}
                    {primeiroNome(t.clienteNome)}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
