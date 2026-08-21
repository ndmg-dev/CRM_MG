import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ReleaseNoteCreate } from '@/types'
import { Button } from '@mg/ui'
import { formatDateTime } from '@/lib/utils'

const NOTA_VAZIA: ReleaseNoteCreate = { system_name: '', description: '' }
const FORM_INICIAL = { version: '', notes: [{ ...NOTA_VAZIA }] }

export default function ReleasesTable() {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)

  const { data: releases = [], isLoading } = useQuery({
    queryKey: ['releases'],
    queryFn: () => api.releases.getAll(),
  })

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['releases'] })
    queryClient.invalidateQueries({ queryKey: ['latest-unread-release'] })
  }

  const createMutation = useMutation({
    mutationFn: () => api.releases.create({
      version: form.version.trim(),
      notes: form.notes
        .map((n) => ({ system_name: n.system_name.trim(), description: n.description.trim() }))
        .filter((n) => n.system_name && n.description),
    }),
    onSuccess: () => {
      invalidar()
      toast.success('Versão publicada! Vai aparecer pros usuários no próximo login.')
      setIsCreating(false)
      setForm(FORM_INICIAL)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao publicar versão.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.releases.delete(id),
    onSuccess: () => {
      invalidar()
      toast.success('Versão excluída.')
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao excluir versão.'),
  })

  const notasValidas = form.notes.filter((n) => n.system_name.trim() && n.description.trim())
  const podeCriar = !!form.version.trim() && notasValidas.length > 0 && !createMutation.isPending

  const updateNota = (index: number, field: keyof ReleaseNoteCreate, value: string) => {
    setForm((f) => ({
      ...f,
      notes: f.notes.map((n, i) => (i === index ? { ...n, [field]: value } : n)),
    }))
  }

  const addNota = () => {
    setForm((f) => ({ ...f, notes: [...f.notes, { ...NOTA_VAZIA }] }))
  }

  const removeNota = (index: number) => {
    setForm((f) => ({ ...f, notes: f.notes.filter((_, i) => i !== index) }))
  }

  const handleDelete = (id: string, version: string) => {
    if (window.confirm(`Excluir a versão ${version} do changelog? Ela some do histórico e do modal pra quem ainda não leu.`)) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) return <LoadingSpinner label="Carregando versões..." />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Cada versão publicada aqui aparece como um modal "Seu CRM foi atualizado" pra quem ainda não viu.
        </p>
        <Button variant="primary" onClick={() => setIsCreating(!isCreating)}>
          <Plus className="h-4 w-4" />
          Nova Versão
        </Button>
      </div>

      {isCreating && (
        <div className="rounded-xl border border-border bg-sidebar p-4">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Publicar Nova Versão</h3>

          <input
            type="text"
            placeholder="Versão (ex: 1.4.0)"
            value={form.version}
            onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
            className="mb-4 w-full max-w-xs rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
          />

          <div className="space-y-3">
            {form.notes.map((nota, i) => (
              <div key={i} className="flex gap-2 rounded-lg border border-border bg-surface/40 p-2">
                <div className="flex flex-1 flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Sistema (ex: Central de Suporte)"
                    value={nota.system_name}
                    onChange={(e) => updateNota(i, 'system_name', e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
                  />
                  <textarea
                    placeholder="O que mudou..."
                    value={nota.description}
                    onChange={(e) => updateNota(i, 'description', e.target.value)}
                    rows={3}
                    maxLength={4000}
                    className="w-full resize-y rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
                  />
                  <p className="-mt-1 text-right text-[11px] text-text-muted">{nota.description.length}/4000</p>
                </div>
                <button
                  onClick={() => removeNota(i)}
                  disabled={form.notes.length === 1}
                  className="h-8 shrink-0 rounded-lg bg-surface-hover p-2 text-text-secondary transition-colors hover:bg-card hover:text-error disabled:opacity-30"
                  aria-label="Remover nota"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={addNota}>
              <Plus className="h-4 w-4" />
              Adicionar linha
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!podeCriar}
              className="rounded-lg bg-success px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-success-hover disabled:opacity-50"
            >
              Publicar
            </button>
            <button
              onClick={() => { setIsCreating(false); setForm(FORM_INICIAL) }}
              className="rounded-lg bg-surface-hover px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-card hover:text-text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {releases.length === 0 && (
          <div className="rounded-xl border border-border bg-sidebar p-8 text-center text-sm text-text-muted">
            Nenhuma versão publicada ainda.
          </div>
        )}
        {releases.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-sidebar p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-sm font-bold text-gold">v{r.version}</span>
                <span className="ml-2 text-xs text-text-muted">{formatDateTime(r.releasedAt)}</span>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleDelete(r.id, r.version)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <ul className="mt-2 space-y-1">
              {r.notes.map((n) => (
                <li key={n.id} className="whitespace-pre-line text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">{n.systemName}:</span> {n.description}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
