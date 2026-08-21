import { useEffect, useState } from 'react'
import { useEmployees } from '../../hooks/useEmployees'
import { useSectors } from '../../hooks/useSectors'
import { useGroups, useCreateGroup, useUpdateGroupMembers, type GroupWithMembers } from '../../hooks/useGroups'
import {
  useResolveWorkSchedule, useCreateWorkScheduleSet,
  type ScopeType, type WorkScheduleSetDay,
} from '../../hooks/useWorkSchedule'
import { Modal } from '../Modal'
import Avatar from '../Avatar'
import MultiEmployeePicker from '../MultiEmployeePicker'

const WEEKDAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

const SCOPE_OPTIONS: { value: ScopeType; label: string }[] = [
  { value: 'todos',       label: 'Todos' },
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'grupo',       label: 'Grupo' },
  { value: 'setor',       label: 'Setor' },
]

const SOURCE_LABEL: Record<ScopeType, string> = {
  todos: 'Todos', colaborador: 'este colaborador', grupo: 'um grupo', setor: 'um setor',
}

const SCOPE_HELP: Record<ScopeType, string> = {
  todos: 'Aplica esta jornada a todos os colaboradores automaticamente.',
  colaborador: 'Aplica esta jornada apenas ao colaborador selecionado.',
  grupo: 'Aplica esta jornada aos colaboradores do grupo selecionado.',
  setor: 'Aplica esta jornada aos colaboradores do setor selecionado.',
}

function hhmmToMinutes(s: string): number {
  const m = s.trim().match(/^(\d{1,3}):(\d{2})$/)
  if (!m) return 0
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function defaultDays(): WorkScheduleSetDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i, is_active: i < 5, start_time: '08:00',
    work_minutes: i < 5 ? 480 : 0, lunch_minutes: i < 5 ? 60 : 0,
  }))
}

export default function WorkScheduleTab() {
  const { data: employees = [] } = useEmployees()
  const { data: sectors = [] } = useSectors()
  const { data: groups = [] } = useGroups()
  const createGroup = useCreateGroup()
  const updateGroupMembers = useUpdateGroupMembers()
  const createSet = useCreateWorkScheduleSet()

  const activeEmployees = employees.filter(e => e.is_active)

  const [scope, setScope] = useState<ScopeType>('todos')
  const [targetId, setTargetId] = useState<string | null>(null)

  const { data: resolved, isFetching: resolving } = useResolveWorkSchedule(scope, targetId)

  const [weeklyTarget, setWeeklyTarget] = useState('40:00')
  const [days, setDays] = useState<WorkScheduleSetDay[]>(defaultDays())
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  const [groupModal, setGroupModal] = useState(false)
  const [groupMembersModal, setGroupMembersModal] = useState<GroupWithMembers | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupMembers, setNewGroupMembers] = useState<Set<string>>(new Set())
  const [groupErr, setGroupErr] = useState('')
  const [savingGroup, setSavingGroup] = useState(false)

  // Ao trocar de escopo/alvo, pré-carrega o formulário: config própria desse
  // escopo se existir, senão a que está em efeito por herança (mostra de
  // onde veio).
  useEffect(() => {
    setSaved(false); setErr('')
    if (!resolved) return
    const source = resolved.own ?? resolved.effective
    if (source) {
      setWeeklyTarget(minutesToHHMM(source.weekly_minutes_target))
      setDays([...source.days].sort((a, b) => a.day_of_week - b.day_of_week))
    } else {
      setWeeklyTarget('40:00')
      setDays(defaultDays())
    }
  }, [resolved])

  function changeDay(idx: number, patch: Partial<WorkScheduleSetDay>) {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d))
    setSaved(false)
  }

  const sumMinutes = days.filter(d => d.is_active).reduce((acc, d) => acc + d.work_minutes, 0)
  const targetMinutes = hhmmToMinutes(weeklyTarget)
  const sumMatches = sumMinutes === targetMinutes

  async function handleSave() {
    if (!sumMatches) return
    setErr(''); setSaved(false)
    try {
      await createSet.mutateAsync({
        scope_type: scope,
        scope_id: scope === 'todos' ? null : targetId,
        weekly_minutes_target: targetMinutes,
        days,
      })
      setSaved(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    }
  }

  function openGroupModal() {
    setNewGroupName(''); setNewGroupMembers(new Set()); setGroupErr('')
    setGroupModal(true)
  }

  async function handleSaveGroup() {
    if (!newGroupName.trim()) { setGroupErr('Nome é obrigatório'); return }
    setSavingGroup(true); setGroupErr('')
    try {
      const group = await createGroup.mutateAsync({ name: newGroupName.trim() })
      await updateGroupMembers.mutateAsync({ id: group.id, member_ids: [...newGroupMembers] })
      setScope('grupo'); setTargetId(group.id)
      setGroupModal(false)
    } catch (e) {
      setGroupErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSavingGroup(false)
    }
  }

  const selectedGroup = groups.find(g => g.id === targetId) ?? null
  const inherited = resolved && !resolved.own && resolved.effective_source
  const gold = 'var(--mg-gold)'

  const muted = 'var(--mg-muted)'

  return (
    <>
      <div className="card">
        <div className="section-title" style={{ color: gold }}>Horário de Trabalho Padrão</div>

        {/* ── Aplicar para ──────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Aplicar para
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {SCOPE_OPTIONS.map(o => (
              <button key={o.value} onClick={() => { setScope(o.value); setTargetId(null) }}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, border: 'none', cursor: 'pointer',
                  background: scope === o.value ? gold : 'rgba(255,255,255,0.08)',
                  color: scope === o.value ? '#000' : '#fff',
                  fontWeight: scope === o.value ? 700 : 400,
                }}>
                {o.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: muted }}>{SCOPE_HELP[scope]}</div>

          {scope === 'colaborador' && (
            <div className="form-group" style={{ maxWidth: 360, marginTop: 12, marginBottom: 0 }}>
              <label className="form-label">Colaborador</label>
              <select className="form-input" value={targetId ?? ''} onChange={e => setTargetId(e.target.value || null)}>
                <option value="">Selecione...</option>
                {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}

          {scope === 'setor' && (
            <div className="form-group" style={{ maxWidth: 360, marginTop: 12, marginBottom: 0 }}>
              <label className="form-label">Setor</label>
              <select className="form-input" value={targetId ?? ''} onChange={e => setTargetId(e.target.value || null)}>
                <option value="">Selecione...</option>
                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {scope === 'grupo' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
              <div className="form-group" style={{ maxWidth: 320, marginBottom: 0, flex: '1 1 240px' }}>
                <label className="form-label">Grupo</label>
                <select className="form-input" value={targetId ?? ''} onChange={e => setTargetId(e.target.value || null)}>
                  <option value="">Selecione...</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.member_count})</option>)}
                </select>
              </div>
              {selectedGroup && (
                <button className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }}
                  onClick={() => setGroupMembersModal(selectedGroup)}>
                  Ver colaboradores
                </button>
              )}
              <button className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }} onClick={openGroupModal}>
                + Criar grupo
              </button>
            </div>
          )}

          {inherited && (
            <div style={{
              marginTop: 12, fontSize: 12, color: gold, background: 'rgba(201,150,12,0.08)',
              border: '0.5px solid rgba(201,150,12,0.25)', borderRadius: 'var(--radius-md)', padding: '8px 12px',
            }}>
              Nenhuma configuração própria para este escopo — herdando de {SOURCE_LABEL[resolved!.effective_source!]}.
              Salvar aqui cria uma configuração específica.
            </div>
          )}
        </div>

        {(scope === 'todos' || targetId) && !resolving && (
          <>
            {/* ── Carga horária semanal ───────────────────────────────────── */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20,
              display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Carga horária semanal (h:min)</label>
                <input className="form-input" value={weeklyTarget}
                  onChange={e => { setWeeklyTarget(e.target.value); setSaved(false) }}
                  placeholder="40:00" style={{ maxWidth: 120, fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Soma dos dias ativos
                </span>
                <span style={{ fontSize: 17, fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>
                  {minutesToHHMM(sumMinutes)}h
                </span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: `0.5px solid ${sumMatches ? 'rgba(201,150,12,0.35)' : 'rgba(226,75,74,0.35)'}`,
                color: sumMatches ? gold : 'var(--mg-red)',
              }}>
                {sumMatches ? 'Igual à carga semanal ✓' : 'Diverge da carga semanal'}
              </span>
            </div>

            {/* ── Jornada por dia ─────────────────────────────────────────── */}
            <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>
              Jornada da semana. Ative/desative dias e ajuste horário de início, carga horária e almoço.
            </p>
            <table className="table" style={{ marginBottom: 20 }}>
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Ativo</th>
                  <th>Início</th>
                  <th>Carga (h:min)</th>
                  <th>Almoço (min)</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => (
                  <tr key={d.day_of_week} style={{ opacity: d.is_active ? 1 : 0.5 }}>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{WEEKDAY_LABELS[d.day_of_week]}-feira</td>
                    <td>
                      <label className="toggle">
                        <input type="checkbox" checked={d.is_active}
                          onChange={e => changeDay(i, { is_active: e.target.checked })} />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <input className="form-input" type="time" value={d.start_time.slice(0, 5)}
                        disabled={!d.is_active} onChange={e => changeDay(i, { start_time: e.target.value })}
                        style={{ maxWidth: 110 }} />
                    </td>
                    <td>
                      <input className="form-input" value={minutesToHHMM(d.work_minutes)}
                        disabled={!d.is_active}
                        onChange={e => changeDay(i, { work_minutes: hhmmToMinutes(e.target.value) })}
                        placeholder="08:00" style={{ maxWidth: 90, fontFamily: 'monospace' }} />
                    </td>
                    <td>
                      <input className="form-input" type="number" min={0} value={d.lunch_minutes}
                        disabled={!d.is_active}
                        onChange={e => changeDay(i, { lunch_minutes: parseInt(e.target.value) || 0 })}
                        style={{ maxWidth: 80 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Ação ─────────────────────────────────────────────────────── */}
            {!sumMatches && (
              <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>
                Ajuste a carga diária até bater com a carga semanal para salvar.
              </div>
            )}
            {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{err}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn-primary" disabled={!sumMatches || createSet.isPending} onClick={handleSave}>
                {createSet.isPending ? 'Salvando...' : 'Salvar horário de trabalho'}
              </button>
              {saved && <span style={{ fontSize: 13, color: 'var(--mg-green)' }}>Salvo ✓</span>}
            </div>
          </>
        )}
      </div>

      {/* Modal ver colaboradores do grupo */}
      <Modal open={!!groupMembersModal} onClose={() => setGroupMembersModal(null)}
        title={`Colaboradores — ${groupMembersModal?.name ?? ''}`} maxWidth={420}>
        {groupMembersModal && groupMembersModal.members.length === 0 && (
          <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
            Nenhum colaborador neste grupo
          </div>
        )}
        {groupMembersModal?.members.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            <Avatar name={m.name} size={28} />
            <div style={{ fontSize: 13, color: '#fff' }}>{m.name}</div>
          </div>
        ))}
        <div className="modal-actions">
          <button className="btn-primary" onClick={() => setGroupMembersModal(null)}>Fechar</button>
        </div>
      </Modal>

      {/* Modal criar grupo */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title="Novo grupo" maxWidth={420}>
        <div className="form-group">
          <label className="form-label">Nome do grupo</label>
          <input className="form-input" autoFocus value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="Ex: Turno da noite" />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ marginBottom: 8 }}>
            Colaboradores ({newGroupMembers.size} selecionados)
          </label>
          <MultiEmployeePicker employees={activeEmployees} selected={newGroupMembers} onChange={setNewGroupMembers} />
        </div>
        {groupErr && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{groupErr}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => setGroupModal(false)}>Cancelar</button>
          <button className="btn-primary" disabled={savingGroup} onClick={handleSaveGroup}>
            {savingGroup ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </>
  )
}
