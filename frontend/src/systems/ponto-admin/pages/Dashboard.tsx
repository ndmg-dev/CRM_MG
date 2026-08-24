import { useState } from 'react'
import { useTodaySummary, useTimeLogs } from '../hooks/useTimeLogs'
import { useEmployees } from '../hooks/useEmployees'
import Avatar from '../components/Avatar'
import Badge from '../components/Badge'
import LocationsBarChart from '../components/dashboard/LocationsBarChart'
import LocationCell from '../components/dashboard/LocationCell'
import MetricCard from '../components/dashboard/MetricCard'
import PresenceRanking from '../components/dashboard/PresenceRanking'
import AbsenceList from '../components/dashboard/AbsenceList'
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
function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
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

export default function Dashboard() {
  const { data: summary, isLoading, isError } = useTodaySummary()
  const { data: employees } = useEmployees()

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

  return (
    <div className="dashboard-page animate-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span style={{ fontSize: 12, color: 'var(--mg-muted)' }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      <div className="grid-kpi">
        <MetricCard
          icon={<UsersCheckIcon />} tone="ok"
          label="Presentes hoje"
          value={stat(summary?.present_today)}
          valueTone={isError ? 'err' : 'ok'}
          sub="Bateram entrada hoje"
          panel={
            <PresenceRanking
              logs={summary?.logs ?? []}
              employees={employees ?? []}
              isLoading={isLoading || !employees}
            />
          }
        />
        <MetricCard
          icon={<UsersXIcon />} tone="err"
          label="Ausentes"
          value={stat(summary?.absent_today)}
          valueTone="neutral"
          sub="Sem registro nem ocorrência"
          panel={
            <AbsenceList
              absentIds={summary?.absent_employee_ids ?? []}
              employees={employees ?? []}
              isLoading={isLoading || !employees}
            />
          }
        />
        <MetricCard
          icon={<ClockIcon />} tone="gold"
          label="Pontos hoje"
          value={stat(summary?.punches_today)}
          sub="Batidas no total"
        />
        <MetricCard
          icon={<AlertTriangleIcon />} tone="warn"
          label="Para revisão"
          value={stat(summary?.pending_review)}
          valueTone={alertTone(summary?.pending_review)}
          sub="Fora do local ou Wi-Fi desconhecido"
        />
        <MetricCard
          icon={<ActivityIcon />} tone="neutral"
          label="Em ocorrência agora"
          value={stat(summary?.in_occurrence_now)}
          valueTone={alertTone(summary?.in_occurrence_now)}
          sub="Saíram e ainda não retornaram"
        />
        <MetricCard
          icon={<FileTextIcon />} tone="gold"
          label="Ocorrências pendentes"
          value={stat(summary?.pending_occurrences_today)}
          valueTone={alertTone(summary?.pending_occurrences_today)}
          sub="Justificativas de hoje a aprovar"
        />
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Pontos do dia</div>
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
          {listView === 'presentes' && (
            <input type="date" className="form-input" style={{ width: 160 }}
              value={selectedDate} max={todayInputDate()}
              onChange={e => setSelectedDate(e.target.value)} />
          )}
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
          <>
            <div className="chart-grid">
              <section className="chart-pane">
                <div className="chart-caption">
                  Locais dos pontos
                  <span className="chart-caption-unit">batidas por local — passe o mouse para ver o endereço</span>
                </div>
                <LocationsBarChart logs={dayLogs ?? []} />
              </section>

              <section className="chart-pane">
                <div className="chart-caption">
                  Concentração geográfica
                  <span className="chart-caption-unit">onde as batidas acontecem com mais frequência</span>
                </div>
                <PunchHeatmap logs={dayLogs ?? []} employees={employees ?? []} />
              </section>
            </div>

            <table className="table" style={{ marginTop: 16 }}>
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
          </>
        )}
      </div>
    </div>
  )
}
