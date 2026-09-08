import Avatar from '../Avatar'
import type { Employee } from '../../hooks/useEmployees'
import type { TodaySummary } from '../../hooks/useTimeLogs'
import { formatTimeShort, localMinutesOfDay } from '../../utils/date'

type TodayLog = TodaySummary['logs'][number]

interface Arrival {
  employeeId: string
  name: string
  /** created_at (ISO) da primeira ENTRADA do dia. */
  arrivedAt: string
  /** Minutos de atraso (+) ou antecipação (−) frente ao work_start_time. */
  deltaMin: number | null
}

/** Minutos desde a meia-noite de um "HH:MM" ou "HH:MM:SS". */
function minutesOfDay(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Ranking de chegada: primeira ENTRADA de cada funcionário hoje, do mais cedo
 * ao mais tarde. Usa os `logs` que /analytics/today já devolve — o mesmo
 * payload que alimenta o contador do cartão, então o total do ranking sempre
 * bate com o número exibido, sem uma chamada extra à API.
 */
function buildArrivals(logs: TodayLog[], employees: Employee[]): Arrival[] {
  const byId = new Map(employees.map(e => [e.id, e]))
  const first = new Map<string, string>()

  for (const log of logs) {
    if (log.type !== 'ENTRADA') continue
    const current = first.get(log.employee_id)
    if (!current || log.created_at < current) first.set(log.employee_id, log.created_at)
  }

  return Array.from(first.entries())
    .map(([employeeId, arrivedAt]) => {
      const emp = byId.get(employeeId)
      // work_start_time é o horário padrão do funcionário; escalas por dia da
      // semana (useSchedule) podem sobrescrevê-lo. O chip de atraso é uma
      // indicação, não o número oficial — este vive nos Relatórios.
      const expected = emp?.work_start_time ? minutesOfDay(emp.work_start_time) : null
      const deltaMin = expected === null ? null : localMinutesOfDay(arrivedAt) - expected
      return { employeeId, name: emp?.name ?? 'Funcionário removido', arrivedAt, deltaMin }
    })
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt))
}

function formatDelta(deltaMin: number): string {
  const abs = Math.abs(deltaMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const value = h ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
  return `${deltaMin > 0 ? '+' : '−'}${value}`
}

interface Props {
  logs: TodayLog[]
  employees: Employee[]
  isLoading?: boolean
}

export default function PresenceRanking({ logs, employees, isLoading }: Props) {
  const arrivals = buildArrivals(logs, employees)

  if (isLoading) {
    return <div className="kpi-detail-empty">Carregando presenças…</div>
  }
  if (!arrivals.length) {
    return <div className="kpi-detail-empty">Nenhuma entrada registrada hoje.</div>
  }

  return (
    <>
      <div className="kpi-detail-title">
        Presentes hoje — {arrivals.length}{' '}
        {arrivals.length === 1 ? 'funcionário com entrada registrada' : 'funcionários com entrada registrada'}
      </div>
      <ol className="kpi-detail-grid cols-3">
        {arrivals.map(a => (
          <li key={a.employeeId} className="kpi-detail-item">
            <Avatar name={a.name} size={22} />
            <span className="kpi-detail-name" title={a.name}>{a.name}</span>
            <span className="kpi-detail-meta">· {formatTimeShort(a.arrivedAt)}</span>
            {a.deltaMin !== null && a.deltaMin !== 0 && (
              <span className={`rank-delta ${a.deltaMin > 0 ? 'is-late' : 'is-early'}`}>
                {formatDelta(a.deltaMin)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </>
  )
}
