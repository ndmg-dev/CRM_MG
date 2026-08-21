import { useState } from 'react'
import { useApproveRegistration, type PendingRegistration } from '../../hooks/useRegistration'
import type { SectorWithMembers } from '../../hooks/useSectors'
import { Modal } from '../Modal'
import { ROLES } from './constants'

export default function ApprovePendingModal({ pending, sectors, onClose }: {
  pending: PendingRegistration
  sectors: SectorWithMembers[]
  onClose: () => void
}) {
  const approveMutation = useApproveRegistration()
  const [form, setForm] = useState({
    phone: pending.phone ?? '', position: '', role: 'colaborador',
    is_external: false, weekly_hours: '40', sector_id: '',
  })
  const [err, setErr] = useState('')

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    try {
      await approveMutation.mutateAsync({
        id: pending.id,
        phone:        form.phone || undefined,
        position:     form.position || undefined,
        role:         form.role,
        is_external:  form.is_external,
        weekly_hours: parseInt(form.weekly_hours) || 40,
        sector_id:    form.sector_id || undefined,
      })
      onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao aprovar') }
  }

  return (
    <Modal open={true} onClose={onClose} title="Aprovar cadastro" maxWidth={420}>
      <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: 'var(--mg-border)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{pending.name}</div>
        <div style={{ fontSize: 12, color: 'var(--mg-muted)' }}>{pending.email}</div>
        <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 4 }}>
          Enviado em {new Date(pending.submitted_at).toLocaleString('pt-BR')}
        </div>
      </div>
      <form onSubmit={handleApprove}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" value={form.phone} placeholder="Opcional"
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Cargo</label>
            <input className="form-input" value={form.position} placeholder="Opcional"
              onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Nível de acesso</label>
            <select className="form-input" value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Horas semanais</label>
            <input className="form-input" type="number" min="1" max="60" value={form.weekly_hours}
              onChange={e => setForm(f => ({ ...f, weekly_hours: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Setor</label>
          <select className="form-input" value={form.sector_id}
            onChange={e => setForm(f => ({ ...f, sector_id: e.target.value }))}>
            <option value="">— Sem setor —</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={approveMutation.isPending}>
            {approveMutation.isPending ? 'Aprovando...' : 'Aprovar e criar funcionário'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
