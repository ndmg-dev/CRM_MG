import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ALL_PERMISSIONS, PERMISSION_LABELS, type Permission } from '../hooks/useAuth'
import { useSectors } from '../hooks/useSectors'
import Avatar from '../components/Avatar'
import Badge from '../components/Badge'
import { Modal } from '../components/Modal'

interface CompanyUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  permissions: Permission[]
  is_active: boolean
  created_at: string
  coordinated_sector?: { id: string; name: string } | null
}

// ─── Modal criar/editar ───────────────────────────────────────────────────────

function UserModal({ user, onClose }: { user?: CompanyUser; onClose: () => void }) {
  const qc = useQueryClient()
  const isNew = !user

  const createMutation = useMutation({
    mutationFn: (d: object) => api.post('/api/v1/auth/users', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-users'] }); onClose() },
  })
  const updateMutation = useMutation({
    mutationFn: (d: object) => api.put(`/api/v1/auth/users/${user?.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-users'] }); onClose() },
  })

  const [form, setForm] = useState({
    name:        user?.name ?? '',
    email:       user?.email ?? '',
    password:    '',
    role:        user?.role ?? 'user',
    permissions: user?.permissions ?? [] as Permission[],
    is_active:   user?.is_active ?? true,
    coordinated_sector_id: user?.coordinated_sector?.id ?? '',
  })
  const [err, setErr] = useState('')
  const { data: sectors = [] } = useSectors()

  const isAdmin = form.role === 'admin'

  function togglePerm(p: Permission) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter(x => x !== p)
        : [...f.permissions, p],
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!form.name.trim()) { setErr('Informe o nome'); return }
    if (!form.email.trim()) { setErr('Informe o e-mail'); return }
    if (isNew && !form.password) { setErr('Informe a senha'); return }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      permissions: isAdmin ? [...ALL_PERMISSIONS] : form.permissions,
      // Admin não é escopado por setor — envia sempre, mesmo vazio, para que
      // o backend saiba distinguir "não mudou" de "removido" (ver model_fields_set).
      coordinated_sector_id: isAdmin ? null : (form.coordinated_sector_id || null),
    }
    if (form.password) payload.password = form.password
    if (!isNew) payload.is_active = form.is_active

    try {
      if (isNew) await createMutation.mutateAsync(payload)
      else await updateMutation.mutateAsync(payload)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao salvar') }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Modal open={true} onClose={onClose} title={isNew ? 'Novo usuário' : 'Editar usuário'} maxWidth={480}>
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input className="form-input" value={form.name} required
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" value={form.email} required
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">{isNew ? 'Senha' : 'Nova senha (deixe vazio para manter)'}</label>
            <input className="form-input" type="password" value={form.password}
              placeholder={isNew ? '' : 'Não alterar'}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Perfil</label>
            <select className="form-input" value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}>
              <option value="admin">Administrador (acesso total)</option>
              <option value="user">Usuário comum (acesso selecionado)</option>
            </select>
          </div>
        </div>

        {!isNew && (
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label className="toggle">
              <input type="checkbox" checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              <span className="toggle-slider" />
            </label>
            <span style={{ fontSize: 13, color: 'var(--mg-muted)' }}>
              {form.is_active ? 'Usuário ativo' : 'Usuário desativado'}
            </span>
          </div>
        )}

        {/* Seleção de permissões */}
        <div className="form-group">
          <label className="form-label">
            Permissões de acesso
            {isAdmin && <span style={{ color: 'var(--mg-green)', marginLeft: 8, fontWeight: 400 }}>— Admin tem todas automaticamente</span>}
          </label>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
            padding: 12, borderRadius: 8,
            background: isAdmin ? 'rgba(42,157,92,0.06)' : 'rgba(255,255,255,0.04)',
            border: 'var(--mg-border)', opacity: isAdmin ? 0.6 : 1,
          }}>
            {ALL_PERMISSIONS.map(p => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isAdmin ? 'default' : 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={isAdmin || form.permissions.includes(p)}
                  disabled={isAdmin}
                  onChange={() => !isAdmin && togglePerm(p)}
                />
                <span style={{ fontSize: 13 }}>{PERMISSION_LABELS[p]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Coordenador de setor — restringe a visão em Relatórios,
            Justificativas e Correções a esse setor. */}
        {!isAdmin && (
          <div className="form-group">
            <label className="form-label">
              Coordenador de setor
              <span style={{ color: 'var(--mg-muted)', marginLeft: 8, fontWeight: 400 }}>
                — opcional; limita o que este usuário vê nas 3 áreas ao setor escolhido
              </span>
            </label>
            <select
              className="form-input"
              value={form.coordinated_sector_id}
              onChange={e => setForm(f => ({ ...f, coordinated_sector_id: e.target.value }))}
            >
              <option value="">Nenhum — vê conforme as permissões acima</option>
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{err}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? 'Salvando...' : isNew ? 'Criar usuário' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Users() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<CompanyUser | undefined | 'new'>()

  const { data: users = [], isLoading } = useQuery<CompanyUser[]>({
    queryKey: ['company-users'],
    queryFn: () => api.get('/api/v1/auth/users'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/auth/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-users'] }),
  })

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Usuários do sistema</h1>
        <button className="btn-primary" onClick={() => setEditing('new')}>+ Novo usuário</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Perfil</th>
              <th>Permissões</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--mg-muted)', padding: 24 }}>Carregando...</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="employee-cell">
                    <Avatar name={u.name} size={32} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge variant={u.role === 'admin' ? 'ok' : 'neutral'}>
                    {u.role === 'admin' ? 'Administrador' : 'Usuário comum'}
                  </Badge>
                  {u.coordinated_sector && (
                    <div style={{ fontSize: 11, color: 'var(--mg-gold)', marginTop: 4 }}>
                      Coordenador: {u.coordinated_sector.name}
                    </div>
                  )}
                </td>
                <td style={{ maxWidth: 280 }}>
                  {u.role === 'admin' ? (
                    <span style={{ fontSize: 12, color: 'var(--mg-green)' }}>Acesso total</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {u.permissions.length === 0
                        ? <span style={{ fontSize: 12, color: 'var(--mg-muted)' }}>Nenhuma</span>
                        : u.permissions.map(p => (
                          <span key={p} style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 4,
                            background: 'rgba(255,255,255,0.08)', color: 'var(--mg-muted)',
                          }}>
                            {PERMISSION_LABELS[p]}
                          </span>
                        ))
                      }
                    </div>
                  )}
                </td>
                <td>
                  <Badge variant={u.is_active ? 'ok' : 'err'}>
                    {u.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => setEditing(u)}>
                      Editar
                    </button>
                    <button className="btn-danger" style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => { if (confirm(`Excluir o usuário ${u.name}?`)) deleteMutation.mutate(u.id) }}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && users.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--mg-muted)', padding: 24 }}>
                Nenhum usuário cadastrado. Crie o primeiro usuário para a equipe.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <UserModal
          user={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
