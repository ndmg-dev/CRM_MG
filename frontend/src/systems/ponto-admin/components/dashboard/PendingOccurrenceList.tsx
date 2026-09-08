import Avatar from '../Avatar'
import type { Employee } from '../../hooks/useEmployees'

interface Props {
  /** Uma entrada por justificativa pendente — quem tem duas aparece duas vezes,
   *  igual ao contador do cartão. */
  employeeIds: string[]
  employees: Employee[]
  isLoading?: boolean
}

/** Justificativas de hoje esperando aprovação. */
export default function PendingOccurrenceList({ employeeIds, employees, isLoading }: Props) {
  if (isLoading) {
    return <div className="kpi-detail-empty">Carregando justificativas…</div>
  }
  if (!employeeIds.length) {
    return <div className="kpi-detail-empty">Nenhuma ocorrência pendente de justificativa.</div>
  }

  const byId = new Map(employees.map(e => [e.id, e]))

  return (
    <>
      <div className="kpi-detail-title">Ocorrências pendentes — justificativas de hoje a aprovar</div>
      <ol className="kpi-detail-grid cols-2">
        {employeeIds.map((id, i) => {
          const name = byId.get(id)?.name ?? 'Funcionário removido'
          return (
            <li key={`${id}-${i}`} className="kpi-detail-item">
              <Avatar name={name} size={22} />
              <span className="kpi-detail-name" title={name}>{name}</span>
            </li>
          )
        })}
      </ol>
    </>
  )
}
