import type { Employee } from '../../hooks/useEmployees'
import type { TodaySummary } from '../../hooks/useTimeLogs'
import { formatTimeShort, formatDuration, minutesSince } from '../../utils/date'

interface Props {
  /** Saídas ainda em aberto, resolvidas por /analytics/today. */
  details: TodaySummary['in_occurrence_now_details']
  employees: Employee[]
  isLoading?: boolean
}

/**
 * Quem saiu em ocorrência e ainda não bateu o retorno.
 *
 * O "fora há" é recalculado a cada render; como /analytics/today revalida a
 * cada 60s, o número anda sozinho sem um timer próprio nesta tela.
 */
export default function OccurrenceNowList({ details, employees, isLoading }: Props) {
  if (isLoading) {
    return <div className="kpi-detail-empty">Carregando ocorrências…</div>
  }
  if (!details.length) {
    return <div className="kpi-detail-empty">Ninguém em ocorrência agora.</div>
  }

  const byId = new Map(employees.map(e => [e.id, e]))

  return (
    <>
      <div className="kpi-detail-title">Em ocorrência agora — saíram e ainda não retornaram</div>
      <ul className="kpi-detail-rows">
        {details.map(({ employee_id, left_at }) => (
          <li key={employee_id} className="kpi-detail-row">
            <span className="kpi-detail-name">
              {byId.get(employee_id)?.name ?? 'Funcionário removido'}
            </span>
            <span className="kpi-detail-meta">
              saiu às {formatTimeShort(left_at)} · fora há {formatDuration(minutesSince(left_at))}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
