import { useState } from 'react'
import { useTodaySummary, useTimeLogs } from '../hooks/useTimeLogs'
import { useEmployees } from '../hooks/useEmployees'
import Avatar from '../components/Avatar'
import Badge from '../components/Badge'
import LocationsBarChart from '../components/dashboard/LocationsBarChart'
import LocationCell from '../components/dashboard/LocationCell'
import MetricCard from '../components/dashboard/MetricCard'
import AbsenceList from '../components/dashboard/AbsenceList'
import ReviewList from '../components/dashboard/ReviewList'
import OccurrenceNowList from '../components/dashboard/OccurrenceNowList'
import PendingOccurrenceList from '../components/dashboard/PendingOccurrenceList'
import HoursRanking from '../components/dashboard/HoursRanking'
import PunchHeatmap from '../components/dashboard/PunchHeatmap'
import { formatTimeShort, todayInputDate, localDayRangeToUtcIso } from '../utils/date'

const STATUS_VARIANT: Record<string, 'ok' | 'warn' | 'err' | 'neutral'> = {
  VERIFICADO: 'ok',
  JUSTIFICADO: 'neutral',
  PENDENTE: 'warn',
  WIFI_DESCONHECIDO: 'warn',
  FORA_DO_LOCAL: 'err',
}

const TYPE_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA_ALMOCO: 'Saída almoço',
  RETORNO_ALMOCO: 'Retorno almoço',
  SAIDA: 'Saída',
  SAIDA_INTERVALO: 'Saída intervalo',
  RETORNO_INTERVALO: 'Retorno intervalo',
}

// Ícones dos cartões de métrica — Feather, mesmo traço (24×24, strokeWidth 2)
// dos ícones da sidebar, para que o conjunto leia como um sistema só.
function UsersCheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>
}
function UsersXIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" y1="8" x2="22" y2="13" /><line x1="22" y1="8" x2="17" y2="13" /></svg>
}
function BarChartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
}
function AlertTriangleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
}
function ActivityIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
}
function FileTextIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
}

/** Cada cartão de KPI é uma aba; o id manda no conteúdo da área de detalhe. */
type KpiId = 'presentes' | 'ausentes' | 'pontos' | 'revisao' | 'ocorrencia' | 'pendentes'

const DETAIL_PANEL_ID = 'kpi-detail-panel'

export default function Dashboard() {
  const { data: summary, isLoading, isError } = useTodaySummary()
  const { data: employees } = useEmployees()

  // Aba corrente. Nunca é nula — "Ranking" é o estado de repouso do painel.
  const [activeKpi, setActiveKpi] = useState<KpiId>('pontos')

  const [selectedDate, setSelectedDate] = useState(todayInputDate())
  const { from, to } = localDayRangeToUtcIso(selectedDate)
  const { data: dayLogs, isLoading: dayLoading, isError: dayError } = useTimeLogs({
    date_from: from, date_to: to, limit: 500,
  })

  // A lista de ausentes só existe pronta para "hoje" (/analytics/today) — quem
  // está ausente depende de justificativas aprovadas, que só o backend
  // conhece. Por isso o toggle "Ausentes" força a data de volta para hoje.
  const [listView, setListView] = useState<'presentes' | 'ausentes'>('presentes')
  const isToday = selectedDate === todayInputDate()

  const employeeMap = Object.fromEntries((employees ?? []).map(e => [e.id, e]))

  // Um valor só existe quando a chamada resolveu: erro vira "!", carregamento "…".
  const stat = (value?: number) => (isError ? '!' : isLoading ? '…' : (value ?? '—'))
  // Contadores de exceção ficam dourados quando há algo a tratar, brancos quando zerados.
  const alertTone = (value?: number) => (isError ? 'err' : (value ?? 0) > 0 ? 'gold' : undefined)

  const listsLoading = isLoading || !employees

  // Detalhe da aba corrente. "Ranking" e "Presentes hoje" são os únicos que não
  // usam o container de detalhe: cada um é um painel `.card` inteiro.
  function renderDetail() {
    switch (activeKpi) {
      case 'ausentes':
        return <AbsenceList absentIds={summary?.absent_employee_ids ?? []} employees={employees ?? []} isLoading={listsLoading} />
      case 'revisao':
        return <ReviewList logs={summary?.logs ?? []} employees={employees ?? []} isLoading={listsLoading} />
      case 'ocorrencia':
        return <OccurrenceNowList details={summary?.in_occurrence_now_details ?? []} employees={employees ?? []} isLoading={listsLoading} />
      case 'pendentes':
        return <PendingOccurrenceList employeeIds={summary?.pending_occurrence_employee_ids ?? []} employees={employees ?? []} isLoading={listsLoading} />
      default:
        return null
    }
  }

  return (
    <div className="dashboard-page animate-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--mg-muted)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          {/* Dia de referência dos dois gráficos e da tabela de últimos pontos. */}
          <input type="date" className="form-input" style={{ width: 160 }}
            aria-label="Dia dos pontos exibidos"
            value={selectedDate} max={todayInputDate()}
            onChange={e => setSelectedDate(e.target.value)} />
        </div>
      </div>

      {/* Gráficos acima da grade de KPIs: são a leitura do dia inteiro, e as
          abas abaixo é que recortam quem/o quê dentro dele. */}
      <div className="chart-grid chart-grid-wide">
        <section className="card chart-pane">
          <div className="panel-head">
            <div className="section-title" style={{ margin: 0 }}>Locais dos pontos</div>
            <div className="panel-caption">batidas por local — passe o mouse para ver o endereço</div>
          </div>
          {dayError
            ? <div className="chart-empty">Erro ao carregar os registros do dia.</div>
            : <LocationsBarChart logs={dayLogs ?? []} />}
        </section>

        <section className="card chart-pane">
          <div className="panel-head">
            <div className="section-title" style={{ margin: 0 }}>Concentração geográfica</div>
            <div className="panel-caption">onde as batidas acontecem com mais frequência</div>
          </div>
          {dayError
            ? <div className="chart-empty">Erro ao carregar os registros do dia.</div>
            : <PunchHeatmap logs={dayLogs ?? []} employees={employees ?? []} />}
        </section>
      </div>

      <div className="grid-kpi" role="tablist" aria-label="Indicadores do dia">
        <MetricCard
          icon={<UsersCheckIcon />} tone="ok"
          label="Presentes hoje"
          value={stat(summary?.present_today)}
          valueTone={isError ? 'err' : 'ok'}
          sub="Bateram entrada hoje"
          active={activeKpi === 'presentes'}
          onSelect={() => setActiveKpi('presentes')}
          controls={DETAIL_PANEL_ID}
        />
        <MetricCard
          icon={<UsersXIcon />} tone="err"
          label="Ausentes"
          value={stat(summary?.absent_today)}
          valueTone="neutral"
          sub="Sem registro nem ocorrência"
          active={activeKpi === 'ausentes'}
          onSelect={() => setActiveKpi('ausentes')}
          controls={DETAIL_PANEL_ID}
        />
        <MetricCard
          icon={<BarChartIcon />} tone="gold"
          label="Ranking"
          value={stat(summary?.punches_today)}
          sub="Batidas no total"
          live
          active={activeKpi === 'pontos'}
          onSelect={() => setActiveKpi('pontos')}
          controls={DETAIL_PANEL_ID}
        />
        <MetricCard
          icon={<AlertTriangleIcon />} tone="warn"
          label="Para revisão"
          value={stat(summary?.pending_review)}
          valueTone={alertTone(summary?.pending_review)}
          sub="Fora do local ou Wi-Fi desconhecido"
          active={activeKpi === 'revisao'}
          onSelect={() => setActiveKpi('revisao')}
          controls={DETAIL_PANEL_ID}
        />
        <MetricCard
          icon={<ActivityIcon />} tone="neutral"
          label="Em ocorrência agora"
          value={stat(summary?.in_occurrence_now)}
          valueTone={alertTone(summary?.in_occurrence_now)}
          sub="Saíram e ainda não retornaram"
          active={activeKpi === 'ocorrencia'}
          onSelect={() => setActiveKpi('ocorrencia')}
          controls={DETAIL_PANEL_ID}
        />
        <MetricCard
          icon={<FileTextIcon />} tone="gold"
          label="Ocorrências pendentes"
          value={stat(summary?.pending_occurrences_today)}
          valueTone={alertTone(summary?.pending_occurrences_today)}
          sub="Justificativas de hoje a aprovar"
          active={activeKpi === 'pendentes'}
          onSelect={() => setActiveKpi('pendentes')}
          controls={DETAIL_PANEL_ID}
        />
      </div>

      <div id={DETAIL_PANEL_ID} role="tabpanel" className="kpi-detail-area">
        {activeKpi === 'pontos' ? (
          <HoursRanking />
        ) : activeKpi === 'presentes' ? (
          <div className="card">
            <div className="panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="section-title" style={{ margin: 0 }}>Últimos pontos batidos</div>
                <div className="view-toggle">
                  <button
                    type="button"
                    className={listView === 'presentes' ? 'view-toggle-btn active' : 'view-toggle-btn'}
                    onClick={() => setListView('presentes')}
                  >
                    Presentes
                  </button>
                  <button
                    type="button"
                    className={listView === 'ausentes' ? 'view-toggle-btn active' : 'view-toggle-btn'}
                    onClick={() => { setListView('ausentes'); setSelectedDate(todayInputDate()) }}
                  >
                    Ausentes
                  </button>
                </div>
              </div>
            </div>

            {listView === 'ausentes' ? (
              <>
                {!isToday && (
                  <div style={{ color: 'var(--mg-muted)', fontSize: 12, marginBottom: 8 }}>
                    A lista de ausentes só está disponível para hoje.
                  </div>
                )}
                <table className="table" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Funcionário</th>
                      <th>Cargo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.absent_employee_ids ?? []).map(id => {
                      const emp = employeeMap[id]
                      return (
                        <tr key={id}>
                          <td>
                            <div className="employee-cell">
                              <Avatar name={emp?.name ?? '?'} />
                              <span>{emp?.name ?? 'Funcionário removido'}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--mg-muted)' }}>{emp?.position ?? '—'}</td>
                        </tr>
                      )
                    })}
                    {!summary?.absent_employee_ids?.length && (
                      <tr><td colSpan={2} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>
                        {isLoading ? 'Carregando...' : 'Ninguém ausente hoje.'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </>
            ) : dayLoading ? (
              <div style={{ color: 'var(--mg-muted)', fontSize: 13, padding: '16px 0' }}>Carregando...</div>
            ) : dayError ? (
              <div style={{ color: 'var(--mg-red)', fontSize: 13, padding: '16px 0' }}>Erro ao carregar registros. Tente recarregar a página.</div>
            ) : (
              <table className="table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Funcionário</th>
                    <th>Horário</th>
                    <th>Tipo</th>
                    <th>Local</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(dayLogs ?? []).map(log => {
                    const emp = employeeMap[log.employee_id]
                    return (
                      <tr key={log.id}>
                        <td>
                          <div className="employee-cell">
                            <Avatar name={emp?.name ?? '?'} />
                            <span>{emp?.name ?? log.employee_id}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--mg-muted)' }}>
                          {formatTimeShort(log.created_at)}
                        </td>
                        <td>{TYPE_LABEL[log.type] ?? log.type}</td>
                        <td className="loc-cell">
                          <LocationCell address={log.address} latitude={log.latitude} longitude={log.longitude} />
                        </td>
                        <td><Badge variant={STATUS_VARIANT[log.status] ?? 'neutral'}>{log.status}</Badge></td>
                      </tr>
                    )
                  })}
                  {!dayLogs?.length && (
                    <tr><td colSpan={5} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>Nenhum registro neste dia</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="kpi-detail">{renderDetail()}</div>
        )}
      </div>
    </div>
  )
}
