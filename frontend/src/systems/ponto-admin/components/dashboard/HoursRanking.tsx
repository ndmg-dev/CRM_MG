import { useMemo, useState } from 'react'
import Avatar from '../Avatar'
import { useSummaryReportRange } from '../../hooks/useReports'
import { todayInputDate, isoWeekBounds, toInputDateLocal, fmtDayMonth } from '../../utils/date'

type Period = 'day' | 'week' | 'month'

const PERIOD_LABEL: Record<Period, string> = {
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
}

/**
 * Intervalo do período que contém `anchor`, cortado em hoje: um período que
 * ainda não terminou não pode cobrar as horas dos dias que faltam, senão todo
 * mundo aparece em déficit até a virada da semana/do mês.
 *
 * A semana sai de `isoWeekBounds` — a mesma que Relatórios usa —, para as duas
 * telas nunca mostrarem saldos diferentes para a mesma semana.
 */
function rangeFor(period: Period, anchor: Date): { from: string; to: string } {
  const today = todayInputDate()
  const cap = (d: Date) => {
    const iso = toInputDateLocal(d)
    return iso < today ? iso : today
  }

  if (period === 'day') {
    const day = toInputDateLocal(anchor)
    return { from: day, to: day }
  }

  if (period === 'week') {
    const { start, end } = isoWeekBounds(anchor)
    return { from: toInputDateLocal(start), to: cap(end) }
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  return { from: toInputDateLocal(start), to: cap(end) }
}

/**
 * Anda um período para trás/frente. No mês, zera o dia antes de somar: partindo
 * de 31/01, `setMonth(+1)` cairia em 03/03, pulando fevereiro inteiro.
 */
function shift(anchor: Date, period: Period, delta: number): Date {
  const next = new Date(anchor)
  if (period === 'day') next.setDate(next.getDate() + delta)
  else if (period === 'week') next.setDate(next.getDate() + 7 * delta)
  else { next.setDate(1); next.setMonth(next.getMonth() + delta) }
  return next
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
  // Âncora do período exibido. Trocar de Dia/Semana/Mês mantém a âncora, então
  // quem está olhando agosto continua em agosto ao mudar a granularidade.
  const [anchor, setAnchor] = useState(() => new Date())

  const { from, to } = useMemo(() => rangeFor(period, anchor), [period, anchor])
  const { data: rows, isLoading, isError } = useSummaryReportRange(from, to, 'team')

  const weekLabel = useMemo(() => {
    const { start, end } = isoWeekBounds(anchor)
    return `${fmtDayMonth(start)} – ${fmtDayMonth(end)}/${end.getFullYear()}`
  }, [anchor])

  // Sem período futuro: o "esperado" de dias que não aconteceram só produziria
  // um ranking de déficits. Compara o início do próximo período com hoje.
  const canGoForward = rangeFor(period, shift(anchor, period, 1)).from <= todayInputDate()

  const anchorIso = toInputDateLocal(anchor)

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
        <div className="rank-period">
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

          {/* Mesmo navegador de Relatórios: ‹ intervalo ›. Em Dia e Mês o
              centro é um campo nativo, para pular direto para uma data
              distante sem clicar a seta dezenas de vezes. */}
          <div className="period-nav">
            <button
              type="button" className="period-nav-arrow" aria-label="Período anterior"
              onClick={() => setAnchor(a => shift(a, period, -1))}
            >‹</button>

            {period === 'week' ? (
              <span className="period-nav-label">{weekLabel}</span>
            ) : period === 'day' ? (
              <input
                type="date" className="period-nav-input"
                aria-label="Dia do ranking"
                value={anchorIso} max={todayInputDate()}
                onChange={e => e.target.value && setAnchor(new Date(`${e.target.value}T00:00:00`))}
              />
            ) : (
              <input
                type="month" className="period-nav-input"
                aria-label="Mês do ranking"
                value={anchorIso.slice(0, 7)} max={todayInputDate().slice(0, 7)}
                onChange={e => e.target.value && setAnchor(new Date(`${e.target.value}-01T00:00:00`))}
              />
            )}

            <button
              type="button" className="period-nav-arrow" aria-label="Próximo período"
              disabled={!canGoForward}
              onClick={() => setAnchor(a => shift(a, period, 1))}
            >›</button>
          </div>
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
