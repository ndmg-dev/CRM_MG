import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { getInitials } from '@/lib/utils'
import { PERFIL_LABELS, SETOR_LABELS } from '@/lib/constants'
import { Check, X, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Perfil, Setor, Usuario } from '@/types'

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

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ perfil: Perfil; setor: Setor; ativo: boolean } | null>(null)

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

  if (isLoading) return <LoadingSpinner label="Carregando usuários..." />

  return (
    <div className="overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#2a2a2a] bg-[#111111]/50">
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6b6b6b]">Usuário</th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6b6b6b]">Perfil</th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6b6b6b]">Setor</th>
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6b6b6b]">Status</th>
            <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#6b6b6b]">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr
              key={u.id}
              className={`transition-colors hover:bg-[#1e1e1e] ${
                i < users.length - 1 ? 'border-b border-[#1e1e1e]' : ''
              }`}
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#252525] text-xs font-bold text-[#d4a843]">
                    {getInitials(u.nome)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#f5f5f5]">{u.nome}</p>
                    <p className="text-xs text-[#a0a0a0]">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5">
                {editingId === u.id && editForm ? (
                  <select
                    className="rounded border border-[#2a2a2a] bg-[#111111] px-2 py-1 text-sm text-[#f5f5f5] outline-none"
                    value={editForm.perfil}
                    onChange={(e) => setEditForm({ ...editForm, perfil: e.target.value as Perfil })}
                  >
                    {Object.entries(PERFIL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#252525] px-2 py-1 text-xs font-medium text-[#a0a0a0]">
                    {u.perfil === 'ADMIN' && <ShieldAlert className="h-3 w-3 text-[#d4a843]" />}
                    {PERFIL_LABELS[u.perfil]}
                  </span>
                )}
              </td>
              <td className="px-5 py-3.5">
                {editingId === u.id && editForm ? (
                  <select
                    className="rounded border border-[#2a2a2a] bg-[#111111] px-2 py-1 text-sm text-[#f5f5f5] outline-none"
                    value={editForm.setor}
                    onChange={(e) => setEditForm({ ...editForm, setor: e.target.value as Setor })}
                  >
                    {Object.entries(SETOR_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-[#a0a0a0]">{SETOR_LABELS[u.setor]}</span>
                )}
              </td>
              <td className="px-5 py-3.5">
                {editingId === u.id && editForm ? (
                  <select
                    className="rounded border border-[#2a2a2a] bg-[#111111] px-2 py-1 text-sm text-[#f5f5f5] outline-none"
                    value={editForm.ativo.toString()}
                    onChange={(e) => setEditForm({ ...editForm, ativo: e.target.value === 'true' })}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                ) : (
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.ativo ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#ef4444]/10 text-[#ef4444]'
                  }`}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                )}
              </td>
              <td className="px-5 py-3.5 text-right">
                {editingId === u.id ? (
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={handleCancel} className="rounded p-1 text-[#ef4444] hover:bg-[#ef4444]/10">
                      <X className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleSave(u.id)} className="rounded p-1 text-[#22c55e] hover:bg-[#22c55e]/10">
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleEdit(u)}
                    className="text-sm text-[#d4a843] hover:text-[#c9952b] hover:underline"
                  >
                    Editar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
