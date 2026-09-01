import Avatar from '../Avatar'
import type { Employee } from '../../hooks/useEmployees'

interface Props {
  /** Ids resolvidos pelo backend — só ele conhece as justificativas aprovadas. */
  absentIds: string[]
  employees: Employee[]
  isLoading?: boolean
}

/**
 * Quem não bateu entrada hoje e não tem ocorrência aprovada cobrindo o dia.
 *
 * A lista vem pronta de /analytics/today em vez de ser derivada aqui: decidir
 * quem está ausente depende das justificativas aprovadas, que o front não
 * recebe. Derivar no cliente daria uma lista maior que o número do cartão.
 */
export default function AbsenceList({ absentIds, employees, isLoading }: Props) {
  if (isLoading) {
    return <div className="kpi-detail-empty">Carregando ausências…</div>
  }
  if (!absentIds.length) {
    return <div className="kpi-detail-empty">Ninguém ausente hoje.</div>
  }

  const byId = new Map(employees.map(e => [e.id, e]))
  const absent = absentIds
    .map(id => ({ id, employee: byId.get(id) }))
    .sort((a, b) => (a.employee?.name ?? '').localeCompare(b.employee?.name ?? '', 'pt-BR'))

  return (
    <>
      <div className="kpi-detail-title">Ausentes — sem batida nem justificativa hoje</div>
      <ol className="kpi-detail-grid cols-2">
        {absent.map(({ id, employee }) => (
          <li key={id} className="kpi-detail-item">
            <Avatar name={employee?.name ?? '?'} size={22} />
            <span className="kpi-detail-name" title={employee?.name}>
              {employee?.name ?? 'Funcionário removido'}
            </span>
            {employee?.position && <span className="kpi-detail-meta">· {employee.position}</span>}
          </li>
        ))}
      </ol>
    </>
  )
}
