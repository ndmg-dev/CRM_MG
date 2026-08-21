import { Modal } from '../Modal'
import FaceCapture from '../FaceCapture'
import Toggle from '../Toggle'
import { ROLES, type FormData } from './constants'

type ModalMode = 'create' | 'edit' | null

interface EmployeeFormModalProps {
  modalMode: ModalMode
  editingId: string | null
  form: FormData
  onChangeForm: (patch: Partial<FormData>) => void
  showCapture: boolean
  onShowCapture: () => void
  faceStatus: 'idle' | 'saving' | 'ok' | 'error'
  faceError: string
  saveError: string
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
  onSaveOnly: () => void
  onClose: () => void
  onFaceComplete: (photos: string[]) => void
  onCancelCapture: () => void
}

export default function EmployeeFormModal({
  modalMode, editingId, form, onChangeForm,
  showCapture, onShowCapture, faceStatus, faceError, saveError, saving,
  onSubmit, onSaveOnly, onClose, onFaceComplete, onCancelCapture,
}: EmployeeFormModalProps) {
  return (
    <Modal
      open={!!modalMode}
      onClose={onClose}
      title={showCapture ? 'Cadastro de biometria' : modalMode === 'create' ? 'Novo Cadastro' : 'Editar funcionário'}
      maxWidth={showCapture ? 560 : 640}
      hideTitle={!!showCapture}
    >
      {showCapture && editingId ? (
        <FaceCapture onComplete={onFaceComplete} onCancel={onCancelCapture} />
      ) : (
        <>
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">Nome completo</label>
              <input className="form-input" value={form.name} autoFocus required
                onChange={e => onChangeForm({ name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" type="email" value={form.email} required
                onChange={e => onChangeForm({ email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone (WhatsApp)</label>
              <input className="form-input" value={form.phone} placeholder="Ex: 87981233683"
                onChange={e => onChangeForm({ phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Cargo</label>
              <input className="form-input" value={form.position} placeholder="Ex: Vendedor"
                onChange={e => onChangeForm({ position: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Data de admissão</label>
              <input className="form-input" type="date" value={form.admission_date}
                onChange={e => onChangeForm({ admission_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Nível de acesso</label>
              <select className="form-input" value={form.role}
                onChange={e => onChangeForm({ role: e.target.value })}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)',
              padding: '12px 14px', marginBottom: 14, border: 'var(--mg-border)',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>TRABALHO EXTERNO</div>
                <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 2 }}>Libera bater ponto fora da empresa</div>
              </div>
              <Toggle checked={form.is_external} onChange={v => onChangeForm({ is_external: v })} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              O horário de trabalho deste colaborador é configurado em
              Configurações → Horário de Trabalho (escopo "Colaborador").
            </div>
            {saveError && (
              <div style={{ fontSize: 12, color: 'var(--mg-red)', background: 'var(--mg-red-dim)',
                border: '0.5px solid var(--mg-red-border)', borderRadius: 'var(--radius-sm)',
                padding: '8px 12px', marginBottom: 12 }}>
                {saveError}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                {modalMode === 'edit' ? 'Fechar' : 'Cancelar'}
              </button>
              {modalMode === 'create' && (
                <button type="button" className="btn-ghost" disabled={saving} onClick={onSaveOnly}>
                  {saving ? 'Salvando...' : 'Salvar sem biometria'}
                </button>
              )}
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Salvando...' : modalMode === 'create' ? 'Salvar e cadastrar biometria →' : 'Salvar'}
              </button>
            </div>
          </form>
          {modalMode === 'edit' && editingId && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: 'var(--mg-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="section-title" style={{ margin: 0 }}>Biometria facial</span>
                {faceStatus === 'ok' && <span style={{ fontSize: 12, color: 'var(--mg-green)' }}>✓ Biometria salva!</span>}
              </div>
              {faceStatus === 'error' && (
                <div style={{ fontSize: 12, color: 'var(--mg-red)', background: 'var(--mg-red-dim)',
                  border: '0.5px solid var(--mg-red-border)', borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px', marginBottom: 12 }}>
                  {faceError}
                </div>
              )}
              {faceStatus === 'saving' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: 'var(--mg-muted)', fontSize: 13 }}>
                  <div className="processing-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  Salvando biometria...
                </div>
              ) : (
                <button className="btn-primary" onClick={onShowCapture}
                  style={{ width: '100%', padding: '10px 0', fontSize: 13 }}>
                  {faceStatus === 'ok' ? 'Recadastrar biometria' : 'Cadastrar biometria (5 fotos guiadas)'}
                </button>
              )}
              <p style={{ marginTop: 10, fontSize: 11, color: 'var(--mg-muted)', lineHeight: 1.5 }}>
                O sistema guia automaticamente 5 capturas em ângulos diferentes.
              </p>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
