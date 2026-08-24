import { useState } from 'react'
import {
  useHolidays, useCreateHoliday, useDeleteHoliday,
  useSpecialSchedules, useCreateSpecialSchedule, useDeleteSpecialSchedule,
  type Holiday, type SpecialSchedule,
} from '../hooks/useCalendar'
import Badge from '../components/Badge'
import { Modal } from '../components/Modal'

const HOLIDAY_TYPES = [
  { value: 'nacional',    label: 'Nacional' },
  { value: 'estadual',    label: 'Estadual' },
  { value: 'municipal',   label: 'Municipal' },
  { value: 'facultativo', label: 'Ponto facultativo' },
]

const WEEKDAYS = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo']


function workHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60
}

// ─── Feriados ─────────────────────────────────────────────────────────────────

function HolidayTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const { data: holidays = [] } = useHolidays(year)
  const createMutation = useCreateHoliday()
  const deleteMutation = useDeleteHoliday()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', date: '', holiday_type: 'nacional', recurrent: false })
  const [err, setErr] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    try {
      await createMutation.mutateAsync({ ...form, date: form.date })
      setModal(false); setForm({ name: '', date: '', holiday_type: 'nacional', recurrent: false })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select className="form-input" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 90 }}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'var(--mg-muted)' }}>{holidays.length} feriado(s)</span>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)} style={{ fontSize: 13 }}>+ Adicionar feriado</button>
      </div>

      {holidays.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--mg-muted)', fontSize: 13 }}>
          Nenhum feriado cadastrado para {year}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {holidays.map((h: Holiday) => (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'rgba(255,255,255,0.03)',
              borderRadius: 'var(--radius-md)', border: 'var(--mg-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'center', minWidth: 44 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--mg-red)', lineHeight: 1 }}>
                    {new Date(h.date.slice(0, 10) + 'T12:00:00').getDate()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--mg-muted)', textTransform: 'uppercase' }}>
                    {new Date(h.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{h.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 2 }}>
                    {WEEKDAYS[new Date(h.date.slice(0, 10) + 'T12:00:00').getDay() === 0 ? 6 : new Date(h.date.slice(0, 10) + 'T12:00:00').getDay() - 1]}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                  <Badge variant="err">{HOLIDAY_TYPES.find(t => t.value === h.holiday_type)?.label ?? h.holiday_type}</Badge>
                  {h.recurrent && <Badge variant="neutral">Recorrente</Badge>}
                </div>
              </div>
              <button onClick={() => deleteMutation.mutate(h.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mg-muted)', fontSize: 16, padding: 4 }}
                title="Excluir">🗑</button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Adicionar feriado" maxWidth={400}>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Data</label>
            <input className="form-input" type="date" value={form.date} required
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" value={form.name} required placeholder="Ex: São João — feriado estadual"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-input" value={form.holiday_type}
              onChange={e => setForm(f => ({ ...f, holiday_type: e.target.value }))}>
              {HOLIDAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <input type="checkbox" id="recurrent" checked={form.recurrent}
              onChange={e => setForm(f => ({ ...f, recurrent: e.target.checked }))}
              style={{ accentColor: 'var(--mg-gold)', width: 15, height: 15 }} />
            <label htmlFor="recurrent" style={{ fontSize: 13, cursor: 'pointer' }}>Recorrente anualmente</label>
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 10 }}>{err}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Jornadas especiais ───────────────────────────────────────────────────────

function ScheduleTab() {
  const { data: schedules = [] } = useSpecialSchedules()
  const createMutation = useCreateSpecialSchedule()
  const deleteMutation = useDeleteSpecialSchedule()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    description: '', schedule_type: 'specific_date',
    date: '', weekday: 0, start_time: '08:00', end_time: '13:00', recurrent: false,
  })
  const [err, setErr] = useState('')

  const hours = workHours(form.start_time, form.end_time)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (hours <= 0) { setErr('Horário de início deve ser antes do de fim'); return }
    try {
      const payload = {
        description: form.description,
        schedule_type: form.schedule_type,
        date: form.schedule_type === 'specific_date' ? form.date : undefined,
        weekday: form.schedule_type === 'recurring_weekday' ? form.weekday : undefined,
        start_time: form.start_time,
        end_time: form.end_time,
        recurrent: form.recurrent,
      }
      await createMutation.mutateAsync(payload)
      setModal(false)
      setForm({ description: '', schedule_type: 'specific_date', date: '', weekday: 0, start_time: '08:00', end_time: '13:00', recurrent: false })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" onClick={() => setModal(true)} style={{ fontSize: 13 }}>+ Adicionar jornada</button>
      </div>

      {schedules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--mg-muted)', fontSize: 13 }}>
          Nenhuma jornada especial cadastrada
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {schedules.map((s: SpecialSchedule) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'rgba(255,255,255,0.03)',
              borderRadius: 'var(--radius-md)', border: 'var(--mg-border)',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.description}</div>
                <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 2 }}>
                  {s.schedule_type === 'specific_date' && s.date
                    ? new Date(s.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                    : `Todas as ${WEEKDAYS[s.weekday ?? 0]}`
                  }
                  {' '}— {s.start_time}–{s.end_time}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge variant="ok">{s.work_hours}h</Badge>
                {s.recurrent && <Badge variant="warn">Recorrente</Badge>}
                <button onClick={() => deleteMutation.mutate(s.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mg-muted)', fontSize: 16, padding: 4 }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Adicionar jornada especial" maxWidth={420}>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Tipo de jornada</label>
            <select className="form-input" value={form.schedule_type}
              onChange={e => setForm(f => ({ ...f, schedule_type: e.target.value }))}>
              <option value="specific_date">Data específica</option>
              <option value="recurring_weekday">Recorrente (dia da semana)</option>
            </select>
          </div>

          {form.schedule_type === 'specific_date' ? (
            <div className="form-group">
              <label className="form-label">Data</label>
              <input className="form-input" type="date" value={form.date} required
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Dia da semana</label>
              <select className="form-input" value={form.weekday}
                onChange={e => setForm(f => ({ ...f, weekday: Number(e.target.value) }))}>
                {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Início</label>
              <input className="form-input" type="time" value={form.start_time} required
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fim</label>
              <input className="form-input" type="time" value={form.end_time} required
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>
          {hours > 0 && (
            <div style={{ fontSize: 12, color: 'var(--mg-green)', marginTop: 6, marginBottom: 12 }}>
              ✓ {hours.toFixed(1)}h de jornada
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" value={form.description} required placeholder="Ex: Sexta reduzida"
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          {form.schedule_type === 'recurring_weekday' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <input type="checkbox" id="recSch" checked={form.recurrent}
                onChange={e => setForm(f => ({ ...f, recurrent: e.target.checked }))}
                style={{ accentColor: 'var(--mg-gold)', width: 15, height: 15 }} />
              <label htmlFor="recSch" style={{ fontSize: 13, cursor: 'pointer' }}>Recorrente</label>
            </div>
          )}

          {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 10 }}>{err}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Tab = 'holidays' | 'schedules'

export default function Calendar() {
  const [tab, setTab] = useState<Tab>('holidays')

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Calendário de trabalho</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: 'var(--mg-border)', paddingBottom: 0 }}>
        {([['holidays', 'Feriados'], ['schedules', 'Jornadas especiais']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 18px', fontSize: 13, fontWeight: tab === key ? 600 : 400,
            color: tab === key ? 'var(--mg-gold)' : 'var(--mg-muted)',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === key ? '2px solid var(--mg-gold)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      <div className="card">
        {tab === 'holidays' ? <HolidayTab /> : <ScheduleTab />}
      </div>
    </div>
  )
}
