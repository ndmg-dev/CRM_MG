import { useEffect, useState } from 'react'
import { departmentsApi, usersApi } from '../../lib/api'
import { useDepartments } from '../../contexts/DepartmentContext'
import { Building2, Plus, Trash2, UserPlus } from 'lucide-react'

const CORES = ['#d4a853', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#14b8a6']

interface DepartmentsPanelProps {
  onToast?: (t: { type: 'success' | 'error'; msg: string }) => void
}

export default function DepartmentsPanel({ onToast }: DepartmentsPanelProps) {
  const { refresh: refreshMyDepartments } = useDepartments()
  const [departments, setDepartments] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [novo, setNovo] = useState({ nome: '', descricao: '', cor: CORES[0] })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [deps, us] = await Promise.all([departmentsApi.getAll(), usersApi.getAll()])
      setDepartments(deps.data || [])
      setUsers(us.data || [])
    } catch (err: any) {
      onToast?.({ type: 'error', msg: err?.response?.data?.error || 'Falha ao carregar setores' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const afterChange = async (msg?: string) => {
    await load()
    await refreshMyDepartments()
    if (msg) onToast?.({ type: 'success', msg })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novo.nome.trim()) return
    setSaving(true)
    try {
      await departmentsApi.create(novo)
      setNovo({ nome: '', descricao: '', cor: CORES[0] })
      await afterChange('Setor criado com sucesso')
    } catch (err: any) {
      onToast?.({ type: 'error', msg: err?.response?.data?.error || 'Falha ao criar setor' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (dept: any) => {
    if (!window.confirm(`Remover o setor "${dept.nome}"? Os tickets ficarão sem setor.`)) return
    try {
      await departmentsApi.delete(dept.id)
      await afterChange('Setor removido')
    } catch (err: any) {
      onToast?.({ type: 'error', msg: err?.response?.data?.error || 'Falha ao remover setor' })
    }
  }

  const handleAddMember = async (deptId: string, userId: string, papel: string) => {
    if (!userId) return
    try {
      await departmentsApi.addMember(deptId, userId, papel)
      await afterChange('Colaborador vinculado ao setor')
    } catch (err: any) {
      onToast?.({ type: 'error', msg: err?.response?.data?.error || 'Falha ao vincular colaborador' })
    }
  }

  const handleRemoveMember = async (deptId: string, userId: string) => {
    try {
      await departmentsApi.removeMember(deptId, userId)
      await afterChange('Colaborador removido do setor')
    } catch (err: any) {
      onToast?.({ type: 'error', msg: err?.response?.data?.error || 'Falha ao remover colaborador' })
    }
  }

  if (loading) return <div className="skeleton" style={{ height: 400, width: '100%' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Criar setor */}
      <form onSubmit={handleCreate} className="glass" style={{ padding: 20, borderRadius: 'var(--radius-lg)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} style={{ color: 'var(--color-accent-gold)' }} />
          Novo Setor
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label htmlFor="dept-nome">Nome *</label>
            <input
              id="dept-nome"
              className="input"
              placeholder="Ex.: Financeiro"
              value={novo.nome}
              onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))}
              required
            />
          </div>
          <div>
            <label htmlFor="dept-desc">Descrição</label>
            <input
              id="dept-desc"
              className="input"
              placeholder="Opcional"
              value={novo.descricao}
              onChange={(e) => setNovo((p) => ({ ...p, descricao: e.target.value }))}
            />
          </div>
          <div>
            <label>Cor</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {CORES.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  aria-label={`Cor ${cor}`}
                  onClick={() => setNovo((p) => ({ ...p, cor }))}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: cor,
                    cursor: 'pointer',
                    border: novo.cor === cor ? '2px solid #f5f0e8' : '2px solid transparent',
                  }}
                />
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={saving || !novo.nome.trim()}>
            {saving ? 'Criando...' : 'Criar Setor'}
          </button>
        </div>
      </form>

      {/* Lista de setores */}
      {departments.map((dept) => {
        const membros = (dept.department_members || []).filter((m: any) => m.users)
        const membroIds = membros.map((m: any) => m.users.id)
        const disponiveis = users.filter((u) => !membroIds.includes(u.id))
        const aberto = expandedId === dept.id

        return (
          <div key={dept.id} className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '18px 24px',
                borderLeft: `3px solid ${dept.cor || '#d4a853'}`,
                cursor: 'pointer',
              }}
              onClick={() => setExpandedId(aberto ? null : dept.id)}
            >
              <Building2 size={20} style={{ color: dept.cor || '#d4a853' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{dept.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {dept.descricao || 'Sem descrição'} · {membros.length} colaborador(es)
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(dept)
                }}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 6 }}
                title="Remover setor"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {aberto && (
              <div style={{ padding: '0 24px 20px', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '16px 0' }}>
                  {membros.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      Nenhum colaborador vinculado.
                    </div>
                  )}
                  {membros.map((m: any) => (
                    <div
                      key={m.users.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 8,
                      }}
                    >
                      {m.users.avatar_url ? (
                        <img src={m.users.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                      ) : (
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--color-bg-hover)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {m.users.full_name?.[0] || 'U'}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{m.users.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.users.email}</div>
                      </div>
                      <select
                        className="input"
                        style={{ width: 130, padding: '6px 10px', fontSize: 12 }}
                        value={m.papel}
                        onChange={(e) => handleAddMember(dept.id, m.users.id, e.target.value)}
                        aria-label={`Papel de ${m.users.full_name} no setor`}
                      >
                        <option value="member">Colaborador</option>
                        <option value="manager">Gestor</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(dept.id, m.users.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 6 }}
                        title="Remover do setor"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <UserPlus size={16} style={{ color: 'var(--color-accent-gold)' }} />
                  <select
                    className="input"
                    style={{ maxWidth: 320, fontSize: 13 }}
                    defaultValue=""
                    onChange={(e) => {
                      handleAddMember(dept.id, e.target.value, 'member')
                      e.target.value = ''
                    }}
                    aria-label="Vincular colaborador ao setor"
                  >
                    <option value="">Vincular colaborador...</option>
                    {disponiveis.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} — {u.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {departments.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <Building2 size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          Nenhum setor cadastrado ainda.
        </div>
      )}
    </div>
  )
}
