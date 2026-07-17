import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { getInitials } from '@/lib/utils'
import { PERFIL_LABELS, SETOR_LABELS } from '@/lib/constants'
import { Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Perfil, Setor, Usuario } from '@/types'

const SETOR_COLORS: Record<string, string> = {
  DP: 'bg-[#ec4899]',
  FISCAL: 'bg-[#06b6d4]',
  CONTABIL: 'bg-[#ef4444]',
  SOCIETARIO: 'bg-[#8b5cf6]',
  TI: 'bg-[#f59e0b]',
  GERAL: 'bg-[#6b7280]',
  RESTRITO: 'bg-[#ef4444]',
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
    <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#141414] p-4">
      <table className="w-full border-separate border-spacing-y-2">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">Nome ↑</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">Cargo</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">Setor ↑↓</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">Status</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="group">
              <td className="rounded-l-lg border border-r-0 border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 transition-colors group-hover:bg-[#1e1e1e]">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d4a843] bg-[#252525] text-xs font-bold text-[#d4a843]">
                    {getInitials(u.nome)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#f5f5f5]">{u.nome}</p>
                    <p className="text-xs text-[#6b6b6b]">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className="border-b border-t border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 transition-colors group-hover:bg-[#1e1e1e]">
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
                  <span className="text-sm text-[#a0a0a0]">
                    {u.perfil === 'ADMIN' ? 'Desenvolvedor' : '—'}
                  </span>
                )}
              </td>
              <td className="border-b border-t border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 transition-colors group-hover:bg-[#1e1e1e]">
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
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${SETOR_COLORS[u.setor] || 'bg-[#6b6b6b]'}`} />
                    <span className="text-sm font-medium text-[#a0a0a0]">{SETOR_LABELS[u.setor]}</span>
                  </div>
                )}
              </td>
              <td className="border-b border-t border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 transition-colors group-hover:bg-[#1e1e1e]">
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
                  <span className={`text-sm font-medium ${u.ativo ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {u.ativo ? 'OK (Ativo)' : 'Inativo'}
                  </span>
                )}
              </td>
              <td className="rounded-r-lg border border-l-0 border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 transition-colors group-hover:bg-[#1e1e1e]">
                {editingId === u.id ? (
                  <div className="flex items-center gap-2">
                    <button onClick={handleCancel} className="rounded p-1 text-[#ef4444] hover:bg-[#ef4444]/10">
                      <X className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleSave(u.id)} className="rounded p-1 text-[#22c55e] hover:bg-[#22c55e]/10">
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(u)}
                      className="rounded-md border border-[#2a2a2a] bg-[#111111] px-3 py-1.5 text-xs font-medium text-[#a0a0a0] transition-colors hover:bg-[#252525] hover:text-[#f5f5f5]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toast.error('Ação de exclusão não implementada.')}
                      className="rounded-md border border-[#ef4444]/30 bg-[#111111] px-3 py-1.5 text-xs font-medium text-[#ef4444] transition-colors hover:bg-[#ef4444]/10"
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
