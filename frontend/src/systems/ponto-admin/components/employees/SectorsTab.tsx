import { useState } from 'react'
import type { Employee } from '../../hooks/useEmployees'
import {
  useSectors, useCreateSector, useUpdateSector, useDeleteSector, useUpdateSectorMembers,
  type SectorWithMembers,
} from '../../hooks/useSectors'
import { useEmployeeLinks } from '../../hooks/useCompanyUsers'
import Avatar from '../Avatar'
import Badge from '../Badge'
import ColorDot from '../ColorDot'
import { Modal } from '../Modal'
import EmployeeAccessPicker from '../EmployeeAccessPicker'
import { ROLES, SECTOR_COLORS } from './constants'

export default function SectorsTab({ employees }: { employees: Employee[] }) {
  const { data: sectors = [], isLoading } = useSectors()
  const { data: employeeLinks = [] } = useEmployeeLinks()
  const createMutation  = useCreateSector()
  const updateMutation  = useUpdateSector()
  const deleteMutation  = useDeleteSector()
  const membersMutation = useUpdateSectorMembers()

  // employee_id -> company_user_id  /  company_user_id -> employee_id
  const linkByEmployeeId = Object.fromEntries(employeeLinks.map(l => [l.employee_id, l.company_user_id]))
  const employeeIdByCompanyUserId = Object.fromEntries(employeeLinks.map(l => [l.company_user_id, l.employee_id]))

  const [selectedSectorId, setSelectedSectorId] = useState<string>('')
  const [modal,   setModal]   = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<SectorWithMembers | null>(null)
  const [form, setForm] = useState({
    name: '', color: SECTOR_COLORS[0],
    coordinator_employee_id: null as string | null,
    assistant_employee_id:   null as string | null,
    break_enabled: false,
    break_paid: true,
    break_minutes: 15,
  })
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [memberSearch, setMemberSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const activeSectorId = selectedSectorId || sectors[0]?.id || ''
  const selectedSector = sectors.find(s => s.id === activeSectorId) ?? null

  function openCreate() {
    setForm({
      name: '', color: SECTOR_COLORS[0], coordinator_employee_id: null, assistant_employee_id: null,
      break_enabled: false, break_paid: true, break_minutes: 15,
    })
    setSelectedMembers(new Set())
    setMemberSearch('')
    setEditing(null); setErr('')
    setModal('create')
  }

  function openEdit(s: SectorWithMembers) {
    setForm({
      name: s.name, color: s.color,
      coordinator_employee_id: s.coordinator_id ? employeeIdByCompanyUserId[s.coordinator_id] ?? null : null,
      assistant_employee_id:   s.assistant_id   ? employeeIdByCompanyUserId[s.assistant_id]   ?? null : null,
      break_enabled: s.break_enabled ?? false,
      break_paid:    s.break_paid ?? true,
      break_minutes: s.break_minutes ?? 15,
    })
    setSelectedMembers(new Set(s.members.map(m => m.id)))
    setMemberSearch('')
    setEditing(s); setErr('')
    setModal('edit')
  }

  function close() { setModal(null); setEditing(null); setErr(''); setMemberSearch('') }

  function toggleMember(id: string) {
    setSelectedMembers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Nome é obrigatório'); return }

    const coordinator_id = form.coordinator_employee_id ? linkByEmployeeId[form.coordinator_employee_id] ?? null : null
    const assistant_id   = form.assistant_employee_id   ? linkByEmployeeId[form.assistant_employee_id]   ?? null : null

    if (form.coordinator_employee_id && !coordinator_id) {
      setErr('Crie o acesso à plataforma do coordenador antes de salvar'); return
    }
    if (form.assistant_employee_id && !assistant_id) {
      setErr('Crie o acesso à plataforma do assistente antes de salvar'); return
    }

    setSaving(true); setErr('')
    try {
      const payload = {
        name: form.name, color: form.color, coordinator_id, assistant_id,
        break_enabled: form.break_enabled,
        break_paid: form.break_paid,
        break_minutes: form.break_minutes,
      }
      if (modal === 'create') {
        const sec = await createMutation.mutateAsync(payload)
        await membersMutation.mutateAsync({ id: sec.id, member_ids: [...selectedMembers] })
        setSelectedSectorId(sec.id)
      } else if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload })
        await membersMutation.mutateAsync({ id: editing.id, member_ids: [...selectedMembers] })
      }
      close()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const activeEmployees = employees.filter(e => e.is_active)
  const filteredMembers = memberSearch
    ? activeEmployees.filter(e => e.name.toLowerCase().includes(memberSearch.toLowerCase()))
    : activeEmployees

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" onClick={openCreate}>+ Novo setor</button>
      </div>

      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--mg-muted)' }}>Carregando...</div>
      )}

      {!isLoading && sectors.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--mg-muted)' }}>Nenhum setor cadastrado</div>
      )}

      {!isLoading && sectors.length > 0 && (
        <>
          {/* Seletor de setor */}
          <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {selectedSector && <ColorDot color={selectedSector.color} size={16} />}
              <select
                className="form-input"
                value={activeSectorId}
                onChange={e => setSelectedSectorId(e.target.value)}
                style={{ fontSize: 14, fontWeight: 500, maxWidth: 320, flex: '1 1 200px' }}
              >
                {sectors.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.member_count} funcionário{s.member_count !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
              {selectedSector && (
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }}
                    onClick={() => openEdit(selectedSector)}>
                    Editar setor
                  </button>
                  <button className="btn-danger" style={{ fontSize: 12, padding: '4px 12px' }}
                    onClick={() => {
                      if (confirm(`Excluir setor "${selectedSector.name}"? Os funcionários ficarão sem setor.`)) {
                        deleteMutation.mutate(selectedSector.id)
                        setSelectedSectorId('')
                      }
                    }}>
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Lista de funcionários do setor selecionado */}
          {selectedSector && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ColorDot color={selectedSector.color} size={10} />
                  {selectedSector.name}
                  <span style={{ fontSize: 11, color: 'var(--mg-muted)', fontWeight: 400 }}>
                    · {selectedSector.member_count} membro{selectedSector.member_count !== 1 ? 's' : ''}
                  </span>
                </div>
                {(selectedSector.coordinator_name || selectedSector.assistant_name) && (
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)', textAlign: 'right', lineHeight: 1.6 }}>
                    {selectedSector.coordinator_name && (
                      <div>Coord.: <span style={{ color: 'var(--mg-white)' }}>{selectedSector.coordinator_name}</span></div>
                    )}
                    {selectedSector.assistant_name && (
                      <div>Assist.: <span style={{ color: 'var(--mg-white)' }}>{selectedSector.assistant_name}</span></div>
                    )}
                  </div>
                )}
              </div>

              {selectedSector.members.length === 0 ? (
                <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
                  Nenhum funcionário neste setor
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Funcionário</th>
                      <th>Cargo</th>
                      <th>Nível</th>
                      <th>Biometria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSector.members.map(m => (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={m.name} size={30} />
                            <div>
                              <div style={{ fontSize: 13, color: '#fff' }}>{m.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--mg-muted)', fontSize: 12 }}>{m.position || '—'}</td>
                        <td>
                          <Badge variant="neutral">
                            {ROLES.find(r => r.value === m.role)?.label ?? m.role}
                          </Badge>
                        </td>
                        <td>
                          <Badge variant={m.face_photos_count > 0 ? 'ok' : 'warn'}>
                            {m.face_photos_count > 0 ? `OK (${m.face_photos_count} fotos)` : 'Pendente'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal criar / editar */}
      <Modal open={!!modal} onClose={close} title={modal === 'create' ? 'Novo Setor' : 'Editar Setor'} maxWidth={480}>
        <div className="form-group">
          <label className="form-label">Nome do setor</label>
          <input className="form-input" autoFocus value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Administrativo" />
        </div>

        <div className="form-group">
          <label className="form-label">Cor identificadora</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            {SECTOR_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                style={{
                  width: 32, height: 32, borderRadius: '50%', background: c, border: 'none',
                  cursor: 'pointer', outline: form.color === c ? '3px solid #fff' : '3px solid transparent',
                  outlineOffset: 2, transition: 'outline 0.1s',
                }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <EmployeeAccessPicker
            label="Coordenador"
            employees={activeEmployees}
            links={linkByEmployeeId}
            value={form.coordinator_employee_id}
            excludeEmployeeId={form.assistant_employee_id}
            onChange={id => setForm(f => ({ ...f, coordinator_employee_id: id }))}
          />
          <EmployeeAccessPicker
            label="Assistente (opcional)"
            employees={activeEmployees}
            links={linkByEmployeeId}
            value={form.assistant_employee_id}
            excludeEmployeeId={form.coordinator_employee_id}
            onChange={id => setForm(f => ({ ...f, assistant_employee_id: id }))}
          />
        </div>

        <div className="form-group" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.break_enabled}
              onChange={e => setForm(f => ({ ...f, break_enabled: e.target.checked }))}
              style={{ accentColor: form.color }} />
            <span className="form-label" style={{ margin: 0 }}>Registrar intervalo (café)</span>
          </label>
          <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 4 }}>
            Adiciona batidas de pausa (manhã e tarde) ao ciclo de ponto deste setor.
          </div>

          {form.break_enabled && (
            <div style={{
              marginTop: 12, paddingLeft: 14, borderLeft: '2px solid rgba(255,255,255,0.1)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div>
                <label className="form-label" style={{ marginBottom: 6 }}>Contabilização das horas</label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer', marginBottom: 6 }}>
                  <input type="radio" name="break_paid" checked={form.break_paid}
                    onChange={() => setForm(f => ({ ...f, break_paid: true }))} />
                  Intervalo pago (não desconta das horas)
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" name="break_paid" checked={!form.break_paid}
                    onChange={() => setForm(f => ({ ...f, break_paid: false }))} />
                  Intervalo descontado das horas
                </label>
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: 6 }}>Duração de referência (min)</label>
                <input className="form-input" type="number" min={1} max={120}
                  value={form.break_minutes}
                  onChange={e => setForm(f => ({ ...f, break_minutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                  style={{ maxWidth: 120 }} />
                <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 4 }}>
                  Pausas acima disso são sinalizadas como anomalia no relatório.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" style={{ marginBottom: 8 }}>
            Funcionários ({selectedMembers.size} selecionados)
          </label>
          <input
            className="form-input"
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            placeholder="Buscar funcionário..."
            style={{ marginBottom: 8 }}
          />
          <div style={{ maxHeight: 240, overflowY: 'auto', border: 'var(--mg-border)', borderRadius: 'var(--radius-md)' }}>
            {filteredMembers.length === 0 && (
              <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--mg-muted)', textAlign: 'center' }}>
                Nenhum funcionário encontrado
              </div>
            )}
            {filteredMembers.map(emp => (
              <label key={emp.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', cursor: 'pointer', borderBottom: 'var(--mg-border)',
                background: selectedMembers.has(emp.id) ? 'rgba(16,185,129,0.08)' : 'transparent',
              }}>
                <input type="checkbox" checked={selectedMembers.has(emp.id)}
                  onChange={() => toggleMember(emp.id)} style={{ accentColor: form.color }} />
                <Avatar name={emp.name} size={28} />
                <div>
                  <div style={{ fontSize: 13, color: '#fff' }}>{emp.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>{emp.position || emp.role}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={close}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </>
  )
}
