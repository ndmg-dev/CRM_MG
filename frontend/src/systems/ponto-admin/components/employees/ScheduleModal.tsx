import type { ScheduleDay } from '../../hooks/useEmployees'
import Toggle from '../Toggle'
import { DAYS } from './constants'

interface ScheduleEditorProps {
  schedule: ScheduleDay[]
  open: boolean
  onToggleOpen: () => void
  onChangeDay: (idx: number, patch: Partial<ScheduleDay>) => void
  // true quando Configurações > Horário de trabalho tem "aplicar a todos"
  // ligado — a escala individual fica só-leitura (o backend também bloqueia
  // o PUT nesse caso, isto é só pra não deixar o usuário editar achando que
  // vai salvar).
  locked?: boolean
}

export default function ScheduleModal({ schedule, open, onToggleOpen, onChangeDay, locked }: ScheduleEditorProps) {
  return (
    <div style={{ borderRadius: 'var(--radius-md)', border: 'var(--mg-border)', overflow: 'hidden', marginBottom: 14 }}>
      <button type="button" onClick={onToggleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', background: 'rgba(255,255,255,0.04)',
          border: 'none', cursor: 'pointer', color: '#fff',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Escala Semanal</div>
            <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>Configurar horários por dia</div>
          </div>
        </div>
        <span style={{ color: 'var(--mg-muted)', fontSize: 13 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: 'var(--mg-border)', background: 'rgba(0,0,0,0.2)' }}>
          {locked ? (
            <p style={{ fontSize: 11, color: 'var(--mg-gold)', marginBottom: 12, lineHeight: 1.5 }}>
              🔒 Horário definido centralmente em Configurações &gt; Horário de trabalho ("aplicar a todos" está
              ligado). Desligue essa opção lá para editar a escala deste colaborador individualmente.
            </p>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--mg-muted)', marginBottom: 12 }}>
              Ative os dias da semana para configurar a jornada de trabalho.
            </p>
          )}
          {schedule.map((day, i) => (
            <div key={i} style={{ marginBottom: 10, opacity: locked ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: day.is_active ? 8 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: day.is_active ? '#fff' : 'var(--mg-muted)' }}>{DAYS[i]}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {day.is_active && <span style={{ fontSize: 11, color: 'var(--mg-gold)', fontWeight: 600, letterSpacing: '0.05em' }}>ATIVADO</span>}
                  <Toggle checked={day.is_active} onChange={v => onChangeDay(i, { is_active: v })} disabled={locked} />
                </div>
              </div>
              {day.is_active && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--mg-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Início</label>
                    <input className="form-input" type="time" value={day.start_time} disabled={locked}
                      onChange={e => onChangeDay(i, { start_time: e.target.value })}
                      style={{ fontSize: 12, padding: '6px 8px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--mg-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Carga (h)</label>
                    <input className="form-input" type="number" min={1} max={24} value={day.work_hours} disabled={locked}
                      onChange={e => onChangeDay(i, { work_hours: Number(e.target.value) })}
                      style={{ fontSize: 12, padding: '6px 8px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--mg-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Almoço (min)</label>
                    <input className="form-input" type="number" min={0} max={180} step={15} value={day.lunch_minutes} disabled={locked}
                      onChange={e => onChangeDay(i, { lunch_minutes: Number(e.target.value) })}
                      style={{ fontSize: 12, padding: '6px 8px' }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
