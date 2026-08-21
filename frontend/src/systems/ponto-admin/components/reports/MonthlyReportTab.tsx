import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ChartDay, CalendarDay, Alert } from '../../hooks/useReports'
import type { TimeLog } from '../../hooks/useTimeLogs'
import type { Justification } from '../../hooks/useJustifications'
import Badge from '../Badge'
import LocationCell from '../dashboard/LocationCell'
import { formatDate, formatTime, formatTimeShort, localMinutesOfDay } from '../../utils/date'
import { TYPE_LABELS, STATUS_LABELS } from '../../utils/labels'
import { C } from './colors'

function fmtDate(s: unknown) {
  if (typeof s !== 'string') return ''
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ─── Horários por tipo de batida (linha) ──────────────────────────────────────
// Paleta categórica validada (ordem fixa, 4 primeiros slots — ver skill de dataviz):
// azul, laranja, aqua, amarelo. Passa CVD/contraste no fundo escuro do painel.
const PUNCH_TYPES = ['ENTRADA', 'SAIDA_ALMOCO', 'RETORNO_ALMOCO', 'SAIDA'] as const
type PunchType = typeof PUNCH_TYPES[number]

const PUNCH_COLOR: Record<PunchType, string> = {
  ENTRADA:        '#3987e5',
  SAIDA_ALMOCO:   '#d95926',
  RETORNO_ALMOCO: '#199e70',
  SAIDA:          '#c98500',
}
const PUNCH_LABEL: Record<PunchType, string> = {
  ENTRADA: 'Entrada', SAIDA_ALMOCO: 'S. Almoço', RETORNO_ALMOCO: 'R. Almoço', SAIDA: 'Saída',
}

function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60), mm = Math.round(m % 60)
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Um ponto por dia com o horário (em minutos desde 00:00) de cada tipo de
 * batida — a primeira ocorrência do dia, mesmo critério do resto do relatório. */
function usePunchTimeSeries(logs: TimeLog[]) {
  return useMemo(() => {
    const byDay = new Map<string, Partial<Record<PunchType, number>>>()
    for (const log of logs) {
      if (!(PUNCH_TYPES as readonly string[]).includes(log.type)) continue
      const day = formatDate(log.created_at) // dd/mm/aaaa, chave de agrupamento local
      const entry = byDay.get(day) ?? {}
      const mins = localMinutesOfDay(log.created_at)
      if (entry[log.type as PunchType] === undefined) entry[log.type as PunchType] = mins
      byDay.set(day, entry)
    }
    return [...byDay.entries()]
      .map(([day, times]) => ({ day, ...times }))
      .sort((a, b) => {
        const [da, ma, ya] = a.day.split('/').map(Number)
        const [db, mb, yb] = b.day.split('/').map(Number)
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime()
      })
  }, [logs])
}

function PunchTimesChart({ logs }: { logs: TimeLog[] }) {
  const data = usePunchTimeSeries(logs)
  const [visible, setVisible] = useState<Record<PunchType, boolean>>({
    ENTRADA: true, SAIDA_ALMOCO: true, RETORNO_ALMOCO: true, SAIDA: true,
  })

  if (data.length === 0) {
    return <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24, fontSize: 13 }}>Sem dados</div>
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ left: 4, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--mg-muted)' }} />
          <YAxis
            domain={[0, 24 * 60]} ticks={[0, 360, 480, 720, 960, 1080, 1440]}
            tickFormatter={minutesToHHMM} tick={{ fontSize: 10, fill: 'var(--mg-muted)' }}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: 'none', fontSize: 11 }}
            formatter={(v, name) => [typeof v === 'number' ? minutesToHHMM(v) : v, name]}
          />
          {PUNCH_TYPES.filter(t => visible[t]).map(t => (
            <Line
              key={t} type="monotone" dataKey={t} name={PUNCH_LABEL[t]}
              stroke={PUNCH_COLOR[t]} strokeWidth={2} dot={{ r: 3 }} connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {/* Legenda como filtro — clicar esconde/mostra a série (mesma cor, nunca reatribuída) */}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        {PUNCH_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setVisible(v => ({ ...v, [t]: !v[t] }))}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
              background: 'none', border: 'none', cursor: 'pointer',
              color: visible[t] ? '#fff' : 'var(--mg-muted)', opacity: visible[t] ? 1 : 0.5,
              padding: 0,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 2, background: PUNCH_COLOR[t], display: 'inline-block' }} />
            {PUNCH_LABEL[t]}
          </button>
        ))}
      </div>
    </>
  )
}

function statusVariant(s: string): 'ok' | 'warn' | 'err' | 'neutral' {
  if (s === 'VERIFICADO')   return 'ok'
  if (s === 'JUSTIFICADO')  return 'neutral'
  if (s === 'FORA_DO_LOCAL') return 'err'
  return 'warn'
}

// ─── Alertas ────────────────────────────────────────────────────────────────

const ALERT_COLORS: Record<string, string> = {
  red: '#EF4444', amber: '#F59E0B', green: '#10B981', purple: '#8B5CF6',
}
const ALERT_ICONS: Record<string, string> = {
  red: '▼', amber: '⚠', green: '★', purple: '●',
}

function AlertCard({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return (
    <div style={{ color: 'var(--mg-muted)', fontSize: 13, padding: '12px 0' }}>Nenhum alerta para este período.</div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.map((a, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 14px', borderRadius: 8,
          background: ALERT_COLORS[a.level] + '15',
          border: `1px solid ${ALERT_COLORS[a.level]}33`,
        }}>
          <span style={{ color: ALERT_COLORS[a.level], fontSize: 14, marginTop: 1, flexShrink: 0 }}>{ALERT_ICONS[a.level]}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
              {a.employee_name || a.sector_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>{a.message}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Calendário de presença ───────────────────────────────────────────────────

const CAL_COLORS = {
  present: { bg: '#D4EDDA', border: '#7DC89A' },
  partial: { bg: '#FFF3CD', border: '#DDA80A' },
  absent:  { bg: '#F8D7DA', border: '#E07580' },
  weekend: { bg: '#E2E3E5', border: '#BBBBBB' },
  holiday: { bg: '#F5C6CB', border: '#D87D86' },
  special: { bg: '#D1ECF1', border: '#5BBFCC' },
}

const CAL_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const CAL_DOW    = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function calCellColor(d: CalendarDay, isGroup: boolean): { bg: string; border: string } {
  if (d.day_type === 'weekend') return CAL_COLORS.weekend
  if (d.day_type === 'holiday') return CAL_COLORS.holiday
  if (d.day_type === 'special') return CAL_COLORS.special
  if (isGroup) {
    const pct = d.attendance_pct ?? 0
    return pct >= 80 ? CAL_COLORS.present : pct >= 40 ? CAL_COLORS.partial : CAL_COLORS.absent
  }
  if (d.is_present) {
    const worked   = d.worked_h ?? 0
    const expected = d.expected_h ?? 0
    return worked >= expected * 0.9 ? CAL_COLORS.present : CAL_COLORS.partial
  }
  if (d.is_justified) return CAL_COLORS.partial
  if ((d.expected_h ?? 0) > 0) return CAL_COLORS.absent
  return { bg: 'transparent', border: 'transparent' }
}

function PresenceCalendar({
  days, year, month, onPrev, onNext,
}: {
  days: CalendarDay[]; year: number; month: number; onPrev: () => void; onNext: () => void
}) {
  const todayStr = new Date().toLocaleDateString('en-CA')
  const isGroup  = days.length > 0 && 'attendance_pct' in days[0]

  const firstDow = new Date(year, month - 1, 1).getDay()
  const cells: (CalendarDay | null)[] = [...Array(firstDow).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Calendário de presença</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 16, lineHeight: 1 }} onClick={onPrev}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', minWidth: 148, textAlign: 'center' }}>
            {CAL_MONTHS[month - 1]} {year}
          </span>
          <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 16, lineHeight: 1 }} onClick={onNext}>›</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {CAL_DOW.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--mg-muted)', fontWeight: 600, padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const { bg, border } = calCellColor(d, isGroup)
          const isToday = d.date === todayStr
          const dayNum  = new Date(d.date + 'T12:00:00').getDate()

          return (
            <div key={i} style={{
              minHeight: 92, background: bg, border: `1px solid ${border}`,
              borderRadius: 6, padding: '6px 7px', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{dayNum}</span>
                {isToday && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', flexShrink: 0 }} />
                )}
              </div>

              {d.day_type === 'holiday' && d.holiday_name && (
                <div style={{ fontSize: 9, color: '#7C3D1E', fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>
                  {d.holiday_name}
                </div>
              )}

              {d.day_type === 'special' && (
                <>
                  {d.special_label && (
                    <div style={{ fontSize: 9, color: '#1E5C4A', fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {d.special_label}
                    </div>
                  )}
                  {d.special_start && d.special_end && (
                    <div style={{ fontSize: 9, color: '#1E5C4A' }}>{d.special_start} – {d.special_end}</div>
                  )}
                </>
              )}

              {!isGroup && d.day_type !== 'weekend' && d.day_type !== 'holiday' && (
                <>
                  {d.entry_time && (
                    <div style={{ fontSize: 9, color: '#1a2e1a', lineHeight: 1.4 }}>
                      {formatTimeShort(d.entry_time)}{d.exit_time ? ` – ${formatTimeShort(d.exit_time)}` : ''}
                    </div>
                  )}
                  {(d.worked_h ?? 0) > 0 && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#1a2e1a' }}>
                      {(d.worked_h ?? 0).toFixed(1)}h
                    </div>
                  )}
                  {d.is_justified && (
                    <div style={{ fontSize: 9, color: '#8B4C0E', fontWeight: 600 }}>Justificado</div>
                  )}
                </>
              )}

              {isGroup && d.day_type !== 'weekend' && d.day_type !== 'holiday' && (
                <>
                  <div style={{ fontSize: 9, color: '#1a1a2e' }}>{d.present_count}/{d.total_count}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#1a1a2e' }}>
                    {(d.attendance_pct ?? 0).toFixed(0)}%
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {([
            { ...CAL_COLORS.present, label: 'Presente' },
            { ...CAL_COLORS.partial, label: 'Parcial / Justificado' },
            { ...CAL_COLORS.absent,  label: 'Ausente' },
            { ...CAL_COLORS.weekend, label: 'Fim de semana' },
            { ...CAL_COLORS.holiday, label: 'Feriado' },
            { ...CAL_COLORS.special, label: 'Jornada especial' },
          ] as const).map(({ bg, border, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--mg-muted)' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${border}`, display: 'inline-block', flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Aba de registros do relatório mensal ─────────────────────────────────────

interface MonthlyReportTabProps {
  showCharts: boolean
  showCalendar: boolean
  showAlerts: boolean
  dailyData: ChartDay[]
  /** Não usado mais aqui (o donut virou o gráfico de horários de ponto) — mantido
   * opcional para não obrigar Reports.tsx a parar de calcular/passar de imediato. */
  doughnutData?: { name: string; value: number; color: string }[]
  calendarDays: CalendarDay[]
  calYear: number
  calMonth: number
  onPrevCalMonth: () => void
  onNextCalMonth: () => void
  filteredAlerts: Alert[]
  logs: TimeLog[]
  expandedLogs: boolean
  onExpandLogs: () => void
  justifications: Justification[]
  onOpenDetail: (log: TimeLog) => void
  onEditLog: (log: TimeLog) => void
  onDeleteLog: (id: string) => void
  onJustifyLog: (log: TimeLog) => void
  /** Nome do colaborador por id — quando informado, exibe a coluna "Colaborador"
   * na tabela (necessário nas visões por Setor/Equipe toda, onde os registros
   * misturam vários funcionários). */
  employeeNames?: Record<string, string>
}

export default function MonthlyReportTab({
  showCharts, showCalendar, showAlerts,
  dailyData,
  calendarDays, calYear, calMonth, onPrevCalMonth, onNextCalMonth,
  filteredAlerts,
  logs, expandedLogs, onExpandLogs, justifications,
  onOpenDetail, onEditLog, onDeleteLog, onJustifyLog,
  employeeNames,
}: MonthlyReportTabProps) {
  const showEmployeeColumn = !!employeeNames
  const [lineMode, setLineMode] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TimeLog['type'] | null>(null)
  const filteredLogs = typeFilter ? logs.filter(l => l.type === typeFilter) : logs
  const visibleLogs = expandedLogs ? filteredLogs : filteredLogs.slice(0, 10)

  return (
    <>
      {/* Painel: Gráficos */}
      {showCharts && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginBottom: 8 }}>Detalhamento diário</div>
              <ResponsiveContainer width="100%" height={200}>
                {lineMode ? (
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: 'var(--mg-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--mg-muted)' }} />
                    <Tooltip contentStyle={{ background: '#1a1a1a', border: 'none', fontSize: 11 }} labelFormatter={s => fmtDate(s)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="expected_h"  stroke={C.expected}    dot={false} name="Esperado" />
                    <Line type="monotone" dataKey="worked_h"    stroke={C.worked}      dot={false} name="Trabalhado" />
                    <Line type="monotone" dataKey="justified_h" stroke={C.justified}   dot={false} name="Justificado" />
                  </LineChart>
                ) : (
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: 'var(--mg-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--mg-muted)' }} />
                    <Tooltip contentStyle={{ background: '#1a1a1a', border: 'none', fontSize: 11 }} labelFormatter={s => fmtDate(s)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="expected_h"    fill={C.expected}    name="Esperado"    stackId="a" />
                    <Bar dataKey="worked_h"      fill={C.worked}      name="Trabalhado"  stackId="b" />
                    <Bar dataKey="justified_h"   fill={C.justified}   name="Justificado" stackId="b" />
                    <Bar dataKey="unjustified_h" fill={C.unjustified} name="Não just."   stackId="b" />
                  </BarChart>
                )}
              </ResponsiveContainer>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mg-muted)', cursor: 'pointer', marginTop: 8 }}>
                <input type="checkbox" checked={lineMode} onChange={e => setLineMode(e.target.checked)} />
                Gráfico de linha
              </label>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginBottom: 8 }}>Horários de ponto</div>
              <PunchTimesChart logs={logs} />
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0 0 16px' }} />
        </>
      )}

      {/* Painel: Calendário */}
      {showCalendar && (
        <>
          <PresenceCalendar
            days={calendarDays}
            year={calYear}
            month={calMonth}
            onPrev={onPrevCalMonth}
            onNext={onNextCalMonth}
          />
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0 0 16px' }} />
        </>
      )}

      {/* Painel: Alertas */}
      {showAlerts && (
        <>
          <AlertCard alerts={filteredAlerts.slice(0, 10)} />
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '16px 0' }} />
        </>
      )}

      {/* Filtro por tipo de batida */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          className={typeFilter === null ? 'btn-primary' : 'btn-ghost'}
          style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => setTypeFilter(null)}
        >
          Todos
        </button>
        {PUNCH_TYPES.map(t => (
          <button
            key={t}
            className={typeFilter === t ? 'btn-primary' : 'btn-ghost'}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setTypeFilter(t)}
          >
            {PUNCH_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Tabela de registros */}
      <table className="table">
        <thead>
          <tr>
            {showEmployeeColumn && <th>Colaborador</th>}
            <th>Data</th><th>Horário</th><th>Tipo</th><th>Status</th>
            <th>Rede</th><th>Local</th><th>Confiança</th><th>Justificativa</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.length === 0 && (
            <tr>
              <td colSpan={showEmployeeColumn ? 10 : 9} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>
                Sem registros no período
              </td>
            </tr>
          )}
          {visibleLogs.map(log => (
            <tr key={log.id} style={{ cursor: 'pointer' }}
              onClick={e => { if ((e.target as HTMLElement).closest('button')) return; onOpenDetail(log) }}>
              {showEmployeeColumn && <td>{employeeNames?.[log.employee_id] ?? '—'}</td>}
              <td>{formatDate(log.created_at)}</td>
              <td style={{ color: 'var(--mg-gold)', fontWeight: 500 }}>{formatTime(log.created_at)}</td>
              <td>{TYPE_LABELS[log.type] ?? log.type}</td>
              <td>
                <Badge variant={statusVariant(log.status)}>
                  {STATUS_LABELS[log.status] ?? log.status}
                </Badge>
              </td>
              <td style={{ fontSize: 11 }}>
                {log.wifi_bssid
                  ? <span title={log.wifi_bssid} style={{ color: 'var(--mg-muted)' }}>📶 {log.wifi_bssid}</span>
                  : <span style={{ color: 'var(--mg-muted)', opacity: 0.4 }}>—</span>}
              </td>
              <td className="loc-cell">
                <LocationCell
                  address={log.address}
                  latitude={log.latitude}
                  longitude={log.longitude}
                />
              </td>
              <td>
                {log.face_confidence != null && (
                  <Badge variant={(1 - log.face_confidence) >= 0.65 ? 'ok' : (1 - log.face_confidence) >= 0.5 ? 'warn' : 'err'}>
                    {((1 - log.face_confidence) * 100).toFixed(1)}%
                  </Badge>
                )}
              </td>
              <td>
                {justifications.find(j => j.time_log_id === log.id)
                  ? <span style={{ fontSize: 11, color: C.justified }}>✓ Justificado</span>
                  : <button onClick={() => onJustifyLog(log)}
                      style={{ fontSize: 11, color: C.justified, background: 'none', border: 'none', cursor: 'pointer' }}>
                      + justificar
                    </button>
                }
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }}
                    onClick={() => onEditLog(log)}>
                    Editar
                  </button>
                  <button className="btn-danger" style={{ padding: '3px 10px', fontSize: 11 }}
                    onClick={() => { if (confirm('Excluir registro?')) onDeleteLog(log.id) }}>
                    🗑
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!expandedLogs && filteredLogs.length > 10 && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={onExpandLogs}>
            Ver todos os {filteredLogs.length} registros
          </button>
        </div>
      )}
    </>
  )
}
