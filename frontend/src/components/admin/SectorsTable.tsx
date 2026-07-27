import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { SETOR_COR_PADRAO } from '@/lib/constants'
import { Check, X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SetorRecord } from '@/types'
import { Button } from '@mg/ui'

const CODIGO_REGEX = /^[A-Z][A-Z0-9_]{1,49}$/

/** Deriva um código a partir do nome: "Departamento Pessoal" → "DEPARTAMENTO_PESSOAL". */
function sugerirCodigo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

const FORM_INICIAL = { codigo: '', nome: '', cor: SETOR_COR_PADRAO }

export default function SectorsTable() {
  const queryClient = useQueryClient()

  const { data: setores = [], isLoading } = useQuery({
    queryKey: ['setores', 'todos'],
    queryFn: () => api.setores.getAll(true),
  })

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['setores'] })
    queryClient.invalidateQueries({ queryKey: ['usuarios'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: Partial<SetorRecord>) => api.setores.create(data),
    onSuccess: () => {
      invalidar()
      toast.success('Setor criado com sucesso!')
      setIsCreating(false)
      setCreateForm(FORM_INICIAL)
      setCodigoEditadoManualmente(false)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar setor.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SetorRecord> }) =>
      api.setores.update(id, data),
    onSuccess: () => {
      invalidar()
      toast.success('Setor atualizado com sucesso!')
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar setor.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.setores.delete(id),
    onSuccess: () => {
      invalidar()
      toast.success('Setor excluído com sucesso!')
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao excluir setor.'),
  })

  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState(FORM_INICIAL)
  const [codigoEditadoManualmente, setCodigoEditadoManualmente] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ nome: string; cor: string; ativo: boolean } | null>(null)

  const codigo = createForm.codigo
  const codigoValido = CODIGO_REGEX.test(codigo)
  const codigoDuplicado = setores.some((s) => s.codigo === codigo)
  const podeCriar =
    !!createForm.nome.trim() && codigoValido && !codigoDuplicado && !createMutation.isPending

  const handleNomeChange = (nome: string) => {
    setCreateForm((f) => ({
      ...f,
      nome,
      codigo: codigoEditadoManualmente ? f.codigo : sugerirCodigo(nome),
    }))
  }

  const handleEdit = (setor: SetorRecord) => {
    setEditingId(setor.id)
    setEditForm({ nome: setor.nome, cor: setor.cor || SETOR_COR_PADRAO, ativo: setor.ativo })
  }

  const handleSave = (id: string) => {
    if (editForm) updateMutation.mutate({ id, data: editForm })
    setEditingId(null)
    setEditForm(null)
  }

  const handleDelete = (setor: SetorRecord) => {
    if (setor.total_usuarios > 0) {
      toast.error(
        `${setor.total_usuarios} colaborador(es) ainda estão neste setor. Reatribua-os antes de excluir.`
      )
      return
    }
    if (window.confirm(`Excluir o setor "${setor.nome}" definitivamente?`)) {
      deleteMutation.mutate(setor.id)
    }
  }

  if (isLoading) return <LoadingSpinner label="Carregando setores..." />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Setores criados aqui ficam disponíveis para atribuição aos colaboradores.
        </p>
        <Button variant="primary" onClick={() => setIsCreating(!isCreating)}>
          <Plus className="h-4 w-4" />
          Novo Setor
        </Button>
      </div>

      {isCreating && (
        <div className="rounded-xl border border-border bg-sidebar p-4">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Cadastrar Novo Setor</h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <input
              type="text"
              placeholder="Nome do setor"
              value={createForm.nome}
              onChange={(e) => handleNomeChange(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary outline-none"
            />
            <div>
              <input
                type="text"
                placeholder="CÓDIGO"
                value={createForm.codigo}
                onChange={(e) => {
                  setCodigoEditadoManualmente(true)
                  setCreateForm((f) => ({ ...f, codigo: sugerirCodigo(e.target.value) }))
                }}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm text-text-primary outline-none"
              />
              {codigo && !codigoValido && (
                <p className="mt-1 text-xs text-error">
                  Use de 2 a 50 caracteres: letras, números e underscore
                </p>
              )}
              {codigoDuplicado && (
                <p className="mt-1 text-xs text-error">Este código já existe</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={createForm.cor}
                onChange={(e) => setCreateForm((f) => ({ ...f, cor: e.target.value }))}
                className="h-9 w-12 cursor-pointer rounded border border-border bg-card"
                aria-label="Cor do setor"
              />
              <span className="text-xs text-text-muted">Cor de identificação</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => createMutation.mutate(createForm)}
                disabled={!podeCriar}
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
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Setor</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Código</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Colaboradores</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Ações</th>
            </tr>
          </thead>
          <tbody>
            {setores.map((s) => (
              <tr key={s.id} className="group">
                <td className="rounded-l-lg border border-r-0 border-border bg-card px-4 py-3 transition-colors group-hover:bg-surface">
                  {editingId === s.id && editForm ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editForm.cor}
                        onChange={(e) => setEditForm({ ...editForm, cor: e.target.value })}
                        className="h-7 w-9 cursor-pointer rounded border border-border bg-sidebar"
                        aria-label="Cor do setor"
                      />
                      <input
                        type="text"
                        value={editForm.nome}
                        onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                        className="rounded border border-border bg-sidebar px-2 py-1 text-sm text-text-primary outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: s.cor || SETOR_COR_PADRAO }}
                      />
                      <span className="text-sm font-medium text-text-primary">{s.nome}</span>
                    </div>
                  )}
                </td>
                <td className="border-b border-t border-border bg-card px-4 py-3 transition-colors group-hover:bg-surface">
                  <span className="font-mono text-xs text-text-muted">{s.codigo}</span>
                </td>
                <td className="border-b border-t border-border bg-card px-4 py-3 transition-colors group-hover:bg-surface">
                  <span className="text-sm text-text-secondary">{s.total_usuarios}</span>
                </td>
                <td className="border-b border-t border-border bg-card px-4 py-3 transition-colors group-hover:bg-surface">
                  {editingId === s.id && editForm ? (
                    <select
                      className="rounded border border-border bg-sidebar px-2 py-1 text-sm text-text-primary outline-none"
                      value={editForm.ativo.toString()}
                      onChange={(e) => setEditForm({ ...editForm, ativo: e.target.value === 'true' })}
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  ) : (
                    <span className={`text-sm font-medium ${s.ativo ? 'text-success' : 'text-error'}`}>
                      {s.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  )}
                </td>
                <td className="rounded-r-lg border border-l-0 border-border bg-card px-4 py-3 transition-colors group-hover:bg-surface">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingId(null); setEditForm(null) }}
                        className="rounded p-1 text-error hover:bg-error/10"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSave(s.id)}
                        className="rounded p-1 text-success hover:bg-success/10"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}>
                        Editar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(s)}>
                        Excluir
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {setores.length === 0 && (
              <tr>
                <td colSpan={5} className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-text-muted">
                  Nenhum setor cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
