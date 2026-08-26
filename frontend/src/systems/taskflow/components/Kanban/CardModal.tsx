import { useState, useEffect } from 'react'
import { usersApi, attachmentsApi, checklistsApi } from '../../lib/api'
import { X, Trash2, Plus } from 'lucide-react'

const STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}

interface CardModalProps {
  ticket: any
  departmentId: string | null
  onSave: (data: any) => Promise<void>
  onClose: () => void
}

export default function CardModal({ ticket, departmentId, onSave, onClose }: CardModalProps) {
  const [formData, setFormData] = useState({
    titulo: ticket?.titulo || '',
    descricao: ticket?.descricao || '',
    status: ticket?.status || 'Backlog',
    prioridade: ticket?.prioridade || 'medium',
    assignee_id: ticket?.assignee_id || '',
    data_inicio: ticket?.data_inicio || '',
    data_fim: ticket?.data_fim || '',
    participants: ticket?.ticket_participants?.map((p: any) => p.users.id) || [],
  })
  const [attachments, setAttachments] = useState<any[]>(ticket?.ticket_attachments || [])
  const [checklists, setChecklists] = useState<any[]>(ticket?.ticket_checklists || [])
  const [newCheckItem, setNewCheckItem] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Só oferece como responsável quem pertence ao setor do board
  const scopeId = ticket?.department_id || departmentId

  useEffect(() => {
    usersApi
      .getAll(scopeId ? { department_id: scopeId } : undefined)
      .then(({ data }) => setUsers(data))
      .catch(() => {})
  }, [scopeId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.titulo.trim()) return

    if (formData.data_inicio && formData.data_fim && formData.data_fim < formData.data_inicio) {
      setFormError('A data de término não pode ser anterior à data de início.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      await onSave({
        ...formData,
        assignee_id: formData.assignee_id || null,
        data_inicio: formData.data_inicio || null,
        data_fim: formData.data_fim || null,
      })
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Falha ao salvar o ticket.')
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !ticket) return

    setUploadingFile(true)
    try {
      const { data } = await attachmentsApi.upload(ticket.id, file)
      if (data) {
        setAttachments((prev) => [...prev, data])
      }
    } catch (err) {
      alert('Falha ao enviar imagem. Verifique se o bucket existe.')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
  }

  // ─── Checklist Handlers ───────────────────────────────

  const handleAddCheckItem = async (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return
    if ('key' in e && e.key === 'Enter') e.preventDefault()
    if (!newCheckItem.trim() || !ticket) return

    try {
      const { data } = await checklistsApi.add(ticket.id, newCheckItem)
      setChecklists((prev) => [...prev, data].sort((a, b) => a.position - b.position))
      setNewCheckItem('')
    } catch (err) {
      console.error('Error adding checklist item:', err)
    }
  }

  const handleToggleCheckItem = async (item: any) => {
    try {
      setChecklists((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: !i.completed } : i)))
      await checklistsApi.update(item.id, { completed: !item.completed })
    } catch (err) {
      setChecklists((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: item.completed } : i)))
    }
  }

  const handleDeleteCheckItem = async (itemId: string) => {
    try {
      setChecklists((prev) => prev.filter((i) => i.id !== itemId))
      await checklistsApi.delete(itemId)
    } catch (err) {
      // Sem rollback: mantém removido da UI mesmo se a chamada falhar
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 28,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {ticket ? 'Editar Ticket' : 'Novo Ticket'}
            </h2>
            {ticket && (
              <span style={{
                background: 'rgba(212,168,83,0.1)',
                color: 'var(--color-accent-gold)',
                border: '1px solid rgba(212,168,83,0.3)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.5px'
              }}>
                NDMG-{ticket.id.substring(0, 8)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Título */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="field-titulo">Título *</label>
            <input
              id="field-titulo"
              className="input"
              type="text"
              placeholder="Descreva a tarefa..."
              value={formData.titulo}
              onChange={handleChange('titulo')}
              autoFocus
              required
            />
          </div>

          {/* Descrição */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="field-descricao">Descrição</label>
            <textarea
              id="field-descricao"
              className="input"
              placeholder="Detalhes adicionais..."
              value={formData.descricao}
              onChange={handleChange('descricao')}
              rows={3}
            />
          </div>

          {/* Status + Prioridade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label htmlFor="field-status">Status</label>
              <select
                id="field-status"
                className="input"
                value={formData.status}
                onChange={handleChange('status')}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="field-prioridade">Prioridade</label>
              <select
                id="field-prioridade"
                className="input"
                value={formData.prioridade}
                onChange={handleChange('prioridade')}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{priorityLabels[p]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Datas de início e término */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label htmlFor="field-data-inicio">Data de Início</label>
              <input
                id="field-data-inicio"
                className="input"
                type="date"
                value={formData.data_inicio || ''}
                onChange={handleChange('data_inicio')}
              />
            </div>
            <div>
              <label htmlFor="field-data-fim">Data de Término (Prazo)</label>
              <input
                id="field-data-fim"
                className="input"
                type="date"
                min={formData.data_inicio || undefined}
                value={formData.data_fim || ''}
                onChange={handleChange('data_fim')}
              />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                O responsável e os participantes recebem aviso por e-mail quando o prazo se aproxima.
              </p>
            </div>
          </div>

          {/* Assignee aprimorado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label htmlFor="field-assignee">Responsável Principal</label>
              <select
                id="field-assignee"
                className="input"
                value={formData.assignee_id}
                onChange={handleChange('assignee_id')}
              >
                <option value="">Nenhum</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Outros Participantes (Convidados)</label>
              <div
                style={{
                  background: 'rgba(5, 5, 8, 0.6)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                  padding: 8, maxHeight: 80, overflowY: 'auto'
                }}
              >
                {users.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      id={`user-${u.id}`}
                      checked={formData.participants.includes(u.id)}
                      onChange={(e) => {
                        const newParts = e.target.checked
                          ? [...formData.participants, u.id]
                          : formData.participants.filter((id: string) => id !== u.id)
                        setFormData((prev) => ({ ...prev, participants: newParts }))
                      }}
                    />
                    <label htmlFor={`user-${u.id}`} style={{ margin: 0, textTransform: 'none', color: 'var(--color-text-primary)' }}>
                      {u.full_name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Checklist Area */}
          {ticket && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <label style={{ margin: 0 }}>Checklist de Tarefas</label>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-border-light)', opacity: 0.3 }}></div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {checklists.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px', borderRadius: 6,
                      background: item.completed ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ cursor: 'pointer' }}
                      checked={item.completed}
                      onChange={() => handleToggleCheckItem(item)}
                    />
                    <span
                      style={{
                        flex: 1, fontSize: 13, color: item.completed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                        textDecoration: item.completed ? 'line-through' : 'none'
                      }}
                    >
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCheckItem(item.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  style={{ height: 32, fontSize: 13 }}
                  placeholder="Adicionar um item..."
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={handleAddCheckItem}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0 8px', height: 32 }}
                  onClick={handleAddCheckItem}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Anexos (Somente tickets existentes) */}
          {ticket && (
            <div style={{ marginBottom: 28, padding: 12, background: 'rgba(212,168,83,0.03)', borderRadius: 8, border: '1px dashed var(--color-border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ margin: 0 }}>Anexos ({attachments.length})</label>
                <label className="btn-secondary" style={{ padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
                  <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleFileUpload} disabled={uploadingFile} />
                  {uploadingFile ? 'Enviando...' : '+ Anexar Imagem'}
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {attachments.map((att) => (
                  <div key={att.id} style={{ position: 'relative', width: 60, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <img src={att.file_url} alt={att.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => window.open(att.file_url, '_blank')} />
                  </div>
                ))}
                {!attachments.length && !uploadingFile && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Nenhum anexo.</div>}
              </div>
            </div>
          )}
          {!ticket && (
            <div style={{ marginBottom: 28, fontSize: 11, color: 'var(--color-text-muted)' }}>
              * Crie o ticket primeiro para poder anexar imagens.
            </div>
          )}

          {formError && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                background: 'var(--color-danger-soft)',
                color: 'var(--color-danger)',
              }}
            >
              {formError}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || uploadingFile || !formData.titulo.trim()}
            >
              {saving ? 'Salvando...' : ticket ? 'Salvar Alterações' : 'Criar Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
