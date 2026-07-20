import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import type { Tarefa, StatusTarefa, Prioridade, Setor } from '@/types'
import { STATUS_LABELS, PRIORITY_LABELS, SETOR_LABELS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'

interface TaskModalProps {
  task?: Tarefa
  onClose: () => void
}

export default function TaskModal({ task, onClose }: TaskModalProps) {
  const isEditing = !!task
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isCoordenador = user?.perfil === 'COORDENADOR'

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.usuarios.getAll(),
  })

  const { data: clientesPage } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => api.clientes.getAll(),
  })
  
  const clientes = clientesPage?.content || []

  const filteredUsuarios = isCoordenador 
    ? usuarios.filter(u => u.setor === user?.setor)
    : usuarios

  const [form, setForm] = useState({
    titulo: task?.titulo || '',
    descricao: task?.descricao || '',
    clienteId: task?.clienteId || '',
    responsavelId: task?.responsavelId || '',
    setorOrigem: (task?.setorOrigem || (isCoordenador ? user?.setor : 'FISCAL')) as Setor,
    prioridade: (task?.prioridade || 'MEDIA') as Prioridade,
    status: (task?.status || 'PENDENTE') as StatusTarefa,
    dataVencimento: task?.dataVencimento?.split('T')[0] || '',
  })

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const createMutation = useMutation({
    mutationFn: () => api.tarefas.create({
      ...form,
      clienteId: form.clienteId || undefined,
      responsavelId: form.responsavelId || undefined,
      dataVencimento: form.dataVencimento ? `${form.dataVencimento}T23:59:00` : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      toast.success('Tarefa criada com sucesso!')
      onClose()
    },
    onError: () => toast.error('Erro ao criar tarefa.'),
  })

  const updateMutation = useMutation({
    mutationFn: () => api.tarefas.update(task!.id, {
      ...form,
      clienteId: form.clienteId || undefined,
      responsavelId: form.responsavelId || undefined,
      dataVencimento: form.dataVencimento ? `${form.dataVencimento}T23:59:00` : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      toast.success('Tarefa atualizada!')
      onClose()
    },
    onError: () => toast.error('Erro ao atualizar tarefa.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.titulo) { toast.error('Título é obrigatório.'); return }
    isEditing ? updateMutation.mutate() : createMutation.mutate()
  }

  const inputClass = "w-full rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-text-primary outline-none focus:border-[#d4a843]"
  const labelClass = "mb-1 block text-xs font-medium text-text-muted"
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}
            </h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <div>
              <label className={labelClass}>Título *</label>
              <input className={inputClass} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título da tarefa" />
            </div>

            <div>
              <label className={labelClass}>Descrição</label>
              <textarea className={`${inputClass} min-h-[80px] resize-none`} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes da tarefa..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Setor</label>
                <select 
                  className={`${inputClass} ${isCoordenador ? 'opacity-70 cursor-not-allowed' : ''}`}
                  value={form.setorOrigem} 
                  onChange={(e) => !isCoordenador && setForm({ ...form, setorOrigem: e.target.value as Setor })}
                  disabled={isCoordenador}
                >
                  {Object.entries(SETOR_LABELS).filter(([k]) => k !== 'DIRETORIA').map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Prioridade</label>
                <select className={inputClass} value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value as Prioridade })}>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Responsável</label>
                <select className={inputClass} value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })}>
                  <option value="">Não atribuído</option>
                  {filteredUsuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Cliente Vinculado</label>
                <select className={inputClass} value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })}>
                  <option value="">Nenhum cliente</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razaoSocial}</option>
                  ))}
                </select>
              </div>
            </div>

            {isEditing && (
              <div>
                <label className={labelClass}>Status</label>
                <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusTarefa })}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={labelClass}>Data de Vencimento</label>
              <input type="date" className={inputClass} value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} />
            </div>

            {/* Metadata (edit mode) */}
            {isEditing && task && (
              <div className="rounded-lg bg-sidebar p-3 text-xs text-text-muted space-y-1">
                <p>Criada em: {formatDateTime(task.dataCriacao)}</p>
                {task.dataConclusao && <p>Concluída em: {formatDateTime(task.dataConclusao)}</p>}
                {task.responsavelNome && <p>Responsável: {task.responsavelNome}</p>}
                {task.clienteNome && <p>Cliente: {task.clienteNome}</p>}
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              <Save className="mr-1 h-4 w-4" />
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
