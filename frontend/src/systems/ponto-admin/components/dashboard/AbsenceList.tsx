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
    return <div className="rank-empty">Carregando ausências…</div>
  }
  if (!absentIds.length) {
    return <div className="rank-empty">Ninguém ausente hoje.</div>
  }

  const byId = new Map(employees.map(e => [e.id, e]))
  const absent = absentIds
    .map(id => ({ id, employee: byId.get(id) }))
    .sort((a, b) => (a.employee?.name ?? '').localeCompare(b.employee?.name ?? '', 'pt-BR'))

  return (
    <div className="rank">
      <div className="rank-head">
        <div>
          <div className="rank-title rank-title-err">Ausentes hoje</div>
          <div className="rank-caption">Sem entrada e sem ocorrência aprovada</div>
        </div>
        <div className="rank-count">{absent.length}</div>
      </div>

      <ol className="rank-list rank-list-plain">
        {absent.map(({ id, employee }) => (
          <li key={id} className="rank-row">
            <Avatar name={employee?.name ?? '?'} size={24} />
            <span className="rank-name" title={employee?.name}>
              {employee?.name ?? 'Funcionário removido'}
            </span>
            {employee?.position && <span className="rank-meta">{employee.position}</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}
