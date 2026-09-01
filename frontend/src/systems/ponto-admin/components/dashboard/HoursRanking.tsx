import { useMemo, useState } from 'react'
import Avatar from '../Avatar'
import { useSummaryReportRange } from '../../hooks/useReports'
import { todayInputDate } from '../../utils/date'

type Period = 'today' | 'week' | 'month'

const PERIOD_LABEL: Record<Period, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
}

/**
 * Intervalo de cada período, sempre terminando hoje ("semana até agora", "mês
 * até agora"). Fechar a semana/o mês no futuro inflaria o esperado com dias
 * que ainda não aconteceram e deixaria todo mundo em déficit.
 */
function rangeFor(period: Period): { from: string; to: string } {
  const to = todayInputDate()
  const today = new Date(`${to}T00:00:00`)

  if (period === 'today') return { from: to, to }

  const from = new Date(today)
  if (period === 'week') {
    // Semana começa na segunda — mesmo 0=segunda…6=domingo da escala semanal.
    const weekday = (today.getDay() + 6) % 7
    from.setDate(today.getDate() - weekday)
  } else {
    from.setDate(1)
  }
  return { from: from.toLocaleDateString('en-CA'), to }
}

/** "8.2h" — uma casa decimal, como o resto dos números de jornada do sistema. */
function hours(value: number): string {
  return `${value.toFixed(1)}h`
}

function balanceLabel(value: number): string {
  const rounded = Number(value.toFixed(1))
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}h`
}

/**
 * Quem trabalhou mais e quem trabalhou menos no período — ordenável pelas
 * horas trabalhadas.
 *
 * O "esperado" vem do backend (`/reports/summary-range`), que resolve escala,
 * feriados e dias sem jornada de cada colaborador; um valor fixo por período
 * (8h/40h/176h) daria saldo errado para horista, meio período e mês com
 * feriado. É o mesmo cálculo dos Relatórios, então os dois nunca divergem.
 */
export default function HoursRanking() {
  const [period, setPeriod] = useState<Period>('month')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { from, to } = useMemo(() => rangeFor(period), [period])
  const { data: rows, isLoading, isError } = useSummaryReportRange(from, to, 'team')

  const sorted = useMemo(() => {
    const list = [...(rows ?? [])]
    list.sort((a, b) => sortDir === 'desc'
      ? b.worked_hours - a.worked_hours
      : a.worked_hours - b.worked_hours)
    return list
  }, [rows, sortDir])

  return (
    <div className="card">
      <div className="panel-head">
        <div>
          <div className="section-title" style={{ margin: 0 }}>Ranking de horas trabalhadas</div>
          <div className="panel-caption">
            quem trabalhou mais e quem trabalhou menos — saldo do período
          </div>
        </div>
        <div className="view-toggle" role="group" aria-label="Período do ranking">
          {(Object.keys(PERIOD_LABEL) as Period[]).map(key => (
            <button
              key={key}
              type="button"
              className={period === key ? 'view-toggle-btn active' : 'view-toggle-btn'}
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
            >
              {PERIOD_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      <table className="table table-rank" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Funcionário</th>
            <th aria-sort={sortDir === 'desc' ? 'descending' : 'ascending'}>
              <button
                type="button"
                className="th-sort"
                onClick={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
              >
                Horas trabalhadas
                <span className="th-sort-arrow" aria-hidden="true">{sortDir === 'desc' ? '▼' : '▲'}</span>
              </button>
            </th>
            <th>Esperado</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr key={row.employee_id}>
              <td>
                <div className="employee-cell">
                  <Avatar name={row.employee_name} size={26} />
                  <span>{row.employee_name}</span>
                </div>
              </td>
              <td className="num-cell num-cell-strong">{hours(row.worked_hours)}</td>
              <td className="num-cell" style={{ color: 'var(--mg-muted)' }}>{hours(row.expected_hours)}</td>
              <td className={`num-cell rank-balance ${row.balance >= 0 ? 'is-up' : 'is-down'}`}>
                {balanceLabel(row.balance)}
              </td>
            </tr>
          ))}
          {!sorted.length && (
            <tr><td colSpan={4} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>
              {isLoading ? 'Carregando...' : isError ? 'Erro ao carregar o ranking.' : 'Nenhum colaborador ativo no período.'}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
