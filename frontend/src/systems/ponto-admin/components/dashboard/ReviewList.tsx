import Badge from '../Badge'
import type { Employee } from '../../hooks/useEmployees'
import type { TodaySummary } from '../../hooks/useTimeLogs'
import { formatTimeShort } from '../../utils/date'

const REVIEW_STATUS: TodaySummary['logs'][number]['status'][] = ['WIFI_DESCONHECIDO', 'FORA_DO_LOCAL']

interface Props {
  logs: TodaySummary['logs']
  employees: Employee[]
  isLoading?: boolean
}

/**
 * Batidas de hoje que caíram fora do local ou num Wi-Fi desconhecido — as
 * mesmas que alimentam o contador "Para revisão", filtradas aqui em vez de
 * numa chamada extra (o payload de /analytics/today já traz status por log).
 */
export default function ReviewList({ logs, employees, isLoading }: Props) {
  if (isLoading) {
    return <div className="kpi-detail-empty">Carregando batidas…</div>
  }

  const pending = logs.filter(log => REVIEW_STATUS.includes(log.status))
  if (!pending.length) {
    return <div className="kpi-detail-empty">Nenhum ponto pendente de revisão hoje.</div>
  }

  const byId = new Map(employees.map(e => [e.id, e]))

  return (
    <>
      <div className="kpi-detail-title">Para revisão — fora do local ou Wi-Fi desconhecido</div>
      <ul className="kpi-detail-rows">
        {pending.map(log => (
          <li key={log.id} className="kpi-detail-row">
            <span className="kpi-detail-name">
              {byId.get(log.employee_id)?.name ?? 'Funcionário removido'}
            </span>
            <span className="kpi-detail-meta">
              {formatTimeShort(log.created_at)}
              <Badge variant={log.status === 'FORA_DO_LOCAL' ? 'err' : 'warn'}>{log.status}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
