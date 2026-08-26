import { useState, useEffect } from 'react'
import { adminApi } from '../lib/api'
import DepartmentsPanel from '../components/Admin/DepartmentsPanel'
import AutomationPanel from '../components/Admin/AutomationPanel'
import { Users, ShieldCheck, Building2, Mail } from 'lucide-react'

const TABS = [
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'departments', label: 'Setores', icon: Building2 },
  { id: 'automation', label: 'Automação', icon: Mail },
]

export default function AdminPage() {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (t: { type: 'success' | 'error'; msg: string }) => {
    setToast(t)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await adminApi.getUsers()
      setUsers(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await adminApi.updateUserRole(userId, newRole)
      setToast({ type: 'success', msg: `Nível de acesso alterado para ${newRole}` })
      fetchUsers()
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.response?.data?.error || 'Falha ao alterar' })
    }

    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldCheck style={{ color: 'var(--color-accent-gold)' }} />
          Admin Panel
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>
          Acessos, setores da empresa e automação de avisos de prazo.
        </p>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === id ? 'var(--color-accent-gold)' : 'transparent'}`,
              color: tab === id ? 'var(--color-accent-gold)' : 'var(--color-text-muted)',
              fontSize: 13,
              fontWeight: tab === id ? 700 : 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              marginBottom: -1,
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {toast && (
        <div style={{
          padding: '12px 16px',
          marginBottom: 16,
          borderRadius: 8,
          background: toast.type === 'success' ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
          color: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          fontSize: 13,
          fontWeight: 600
        }}>
          {toast.msg}
        </div>
      )}

      {tab === 'departments' && <DepartmentsPanel onToast={showToast} />}
      {tab === 'automation' && <AutomationPanel onToast={showToast} />}

      {tab === 'users' && (loading && !users.length ? (
        <div className="skeleton" style={{ height: 400, width: '100%' }} />
      ) : error ? (
        <div style={{ color: 'var(--color-danger)' }}>{error}</div>
      ) : (
        <div className="glass" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(212,168,83,0.05)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '16px 24px', fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-secondary)', letterSpacing: 1 }}>Membro</th>
                <th style={{ padding: '16px 24px', fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-secondary)', letterSpacing: 1 }}>E-mail corporativo</th>
                <th style={{ padding: '16px 24px', fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-secondary)', letterSpacing: 1 }}>Acesso Atual</th>
                <th style={{ padding: '16px 24px', fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-secondary)', letterSpacing: 1 }}>Papel / Modificar</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.full_name} style={{ width: 36, height: 36, borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {u.full_name?.[0] || 'U'}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Registrado em {new Date(u.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--color-text-secondary)' }}>
                    {u.email}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase',
                      background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.15)' : u.role === 'developer' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(212, 168, 83, 0.15)',
                      color: u.role === 'admin' ? '#ef4444' : u.role === 'developer' ? '#3b82f6' : '#d4a853',
                      border: `1px solid ${u.role === 'admin' ? 'rgba(239,68,68,0.3)' : u.role === 'developer' ? 'rgba(59,130,246,0.3)' : 'rgba(212,168,83,0.3)'}`
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <select
                      className="input"
                      style={{ width: 140, padding: '8px 12px', fontSize: 12 }}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="admin">Administrador</option>
                      <option value="developer">Developer</option>
                      <option value="viewer">Viewer (Convidados)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              Nenhum usuário cadastrado
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
