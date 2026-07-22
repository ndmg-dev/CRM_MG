import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { getInitials } from '@/lib/utils'
import { PERFIL_LABELS, SETOR_LABELS } from '@/lib/constants'
import { Check, X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Perfil, Setor, Usuario } from '@/types'
import { Button, Badge } from '@mg/ui'

const SETOR_COLORS: Record<string, string> = {
  DP: 'bg-accent-pink',
  FISCAL: 'bg-accent-cyan',
  CONTABIL: 'bg-error',
  SOCIETARIO: 'bg-accent-purple',
  TI: 'bg-warning',
  GERAL: 'bg-text-muted',
  RESTRITO: 'bg-error',
}

export default function UsersTable() {
  const queryClient = useQueryClient()
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.usuarios.getAll(),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Usuario> }) =>
      api.usuarios.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Usuário atualizado com sucesso!')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar usuário.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.usuarios.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Usuário excluído com sucesso!')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao excluir usuário.')
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Usuario>) => api.usuarios.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Usuário criado com sucesso!')
      setIsCreating(false)
      setCreateForm({ nome: '', email: '', perfil: 'VISUALIZADOR' as Perfil, setor: 'GERAL' as Setor, ativo: true })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao criar usuário.')
    },
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ perfil: Perfil; setor: Setor; ativo: boolean } | null>(null)

  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ nome: '', email: '', perfil: 'VISUALIZADOR' as Perfil, setor: 'GERAL' as Setor, ativo: true })

  const handleEdit = (user: Usuario) => {
    setEditingId(user.id)
    setEditForm({ perfil: user.perfil, setor: user.setor, ativo: user.ativo })
  }

  const handleSave = (id: string) => {
    if (editForm) {
      updateMutation.mutate({ id, data: editForm })
    }
    setEditingId(null)
    setEditForm(null)
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm(null)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário definitivamente?')) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) return <LoadingSpinner label="Carregando usuários..." />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => setIsCreating(!isCreating)}
        >
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {isCreating && (
        <div className="rounded-xl border border-border bg-sidebar p-4">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Cadastrar Novo Usuário</h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
            <input
              type="text"
              placeholder="Nome completo"
              value={createForm.nome}
              onChange={e => setCreateForm(f => ({ ...f, nome: e.target.value }))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary outline-none"
            />
            <input
              type="email"
              placeholder="E-mail"
              value={createForm.email}
              onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary outline-none"
            />
            <select
              value={createForm.perfil}
              onChange={e => setCreateForm(f => ({ ...f, perfil: e.target.value as Perfil }))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary outline-none"
            >
              {Object.entries(PERFIL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select
              value={createForm.setor}
              onChange={e => setCreateForm(f => ({ ...f, setor: e.target.value as Setor }))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary outline-none"
            >
              {Object.entries(SETOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => createMutation.mutate(createForm)}
                disabled={createMutation.isPending || !createForm.nome || !createForm.email}
                className="flex-1 rounded-lg bg-success py-2 text-sm font-bold text-white transition-colors hover:bg-success-hover disabled:opacity-50"
              >
                Salvar
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="rounded-lg bg-surface-hover p-2 text-text-secondary transition-colors hover:bg-card hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-sidebar p-4">
        <table className="w-full border-separate border-spacing-y-2">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Nome ↑</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Cargo</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Setor ↑↓</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Status</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="group">
              <td className="rounded-l-lg border border-r-0 border-border bg-card px-4 py-3 transition-colors group-hover:bg-surface">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold bg-surface-hover text-xs font-bold text-gold">
                    {getInitials(u.nome)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{u.nome}</p>
                    <p className="text-xs text-text-muted">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className="border-b border-t border-border bg-card px-4 py-3 transition-colors group-hover:bg-surface">
                {editingId === u.id && editForm ? (
                  <select
                    className="rounded border border-border bg-sidebar px-2 py-1 text-sm text-text-primary outline-none"
                    value={editForm.perfil}
                    onChange={(e) => setEditForm({ ...editForm, perfil: e.target.value as Perfil })}
                  >
                    {Object.entries(PERFIL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-text-secondary">
                    {u.perfil === 'ADMIN' ? 'Desenvolvedor' : '—'}
                  </span>
                )}
              </td>
              <td className="border-b border-t border-border bg-card px-4 py-3 transition-colors group-hover:bg-surface">
                {editingId === u.id && editForm ? (
                  <select
                    className="rounded border border-border bg-sidebar px-2 py-1 text-sm text-text-primary outline-none"
                    value={editForm.setor}
                    onChange={(e) => setEditForm({ ...editForm, setor: e.target.value as Setor })}
                  >
                    {Object.entries(SETOR_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${SETOR_COLORS[u.setor] || 'bg-text-muted'}`} />
                    <span className="text-sm font-medium text-text-secondary">{SETOR_LABELS[u.setor]}</span>
                  </div>
                )}
              </td>
              <td className="border-b border-t border-border bg-card px-4 py-3 transition-colors group-hover:bg-surface">
                {editingId === u.id && editForm ? (
                  <select
                    className="rounded border border-border bg-sidebar px-2 py-1 text-sm text-text-primary outline-none"
                    value={editForm.ativo.toString()}
                    onChange={(e) => setEditForm({ ...editForm, ativo: e.target.value === 'true' })}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                ) : (
                  <span className={`text-sm font-medium ${u.ativo ? 'text-success' : 'text-error'}`}>
                    {u.ativo ? 'OK (Ativo)' : 'Inativo'}
                  </span>
                )}
              </td>
              <td className="rounded-r-lg border border-l-0 border-border bg-card px-4 py-3 transition-colors group-hover:bg-surface">
                {editingId === u.id ? (
                  <div className="flex items-center gap-2">
                    <button onClick={handleCancel} className="rounded p-1 text-error hover:bg-error/10">
                      <X className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleSave(u.id)} className="rounded p-1 text-success hover:bg-success/10">
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(u)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(u.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  )
}
