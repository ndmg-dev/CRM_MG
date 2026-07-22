import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Plus, Filter, X } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import PageHeader from '@/components/common/PageHeader'
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'
import toast from 'react-hot-toast'
import type { Tarefa, StatusTarefa, TaskFilters } from '@/types'
import { STATUS_LABELS, STATUS_COLORS, KANBAN_COLUMNS, SETOR_LABELS, PRIORITY_LABELS } from '@/lib/constants'

export default function KanbanBoard() {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  useEffect(() => { setCurrentPage('Tarefas') }, [setCurrentPage])

  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isManager = user?.perfil === 'ADMIN' || user?.perfil === 'COORDENADOR'
  const isAdmin = user?.perfil === 'ADMIN'

  const [selectedTask, setSelectedTask] = useState<Tarefa | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({})

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ['tarefas', filters],
    queryFn: () => api.tarefas.getAll(Object.keys(filters).length > 0 ? filters : undefined),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusTarefa }) =>
      api.tarefas.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tarefas'] })
      const previous = queryClient.getQueryData<Tarefa[]>(['tarefas', filters])
      queryClient.setQueryData<Tarefa[]>(['tarefas', filters], (old) =>
        old?.map((t) => (t.id === id ? { ...t, status } : t)) || []
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tarefas', filters], context.previous)
      }
      toast.error('Erro ao atualizar status. Revertendo...')
    },
    onSuccess: () => {
      toast.success('Status atualizado!')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
    },
  })

  const handleDragEnd = useCallback((result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination || destination.droppableId === source.droppableId) return

    const newStatus = destination.droppableId as StatusTarefa
    statusMutation.mutate({ id: draggableId, status: newStatus })
  }, [statusMutation])

  const getColumnTasks = (status: StatusTarefa) =>
    tarefas.filter((t) => t.status === status)

  const hasActiveFilters = Object.values(filters).some(Boolean)

  if (isLoading) return <LoadingSpinner label="Carregando tarefas..." />

  return (
    <div>
      <PageHeader
        title="Quadro de Tarefas"
        description="Gerencie as obrigações e demandas internas"
        actions={
          isManager && (
            <div className="flex gap-2">
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-1 h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-xs text-black">
                    !
                  </span>
                )}
              </Button>
              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Nova Tarefa
              </Button>
            </div>
          )
        }
      />

      {/* Filters bar */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
        >
          {isAdmin && (
            <select
              className="rounded-md border border-border bg-surface-hover px-3 py-1.5 text-sm text-text-primary outline-none"
              value={filters.setor || ''}
              onChange={(e) => setFilters({ ...filters, setor: e.target.value as any || undefined })}
            >
              <option value="">Todos os Setores</option>
              {Object.entries(SETOR_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          )}
          <select
            className="rounded-md border border-border bg-surface-hover px-3 py-1.5 text-sm text-text-primary outline-none"
            value={filters.prioridade || ''}
            onChange={(e) => setFilters({ ...filters, prioridade: e.target.value as any || undefined })}
          >
            <option value="">Todas as Prioridades</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
              <X className="mr-1 h-3 w-3" />
              Limpar
            </Button>
          )}
        </motion.div>
      )}

      {/* Kanban columns */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {KANBAN_COLUMNS.map((status) => {
            const tasks = getColumnTasks(status)
            const colors = STATUS_COLORS[status]

            return (
              <div key={status} className="flex flex-col">
                {/* Column header */}
                <div className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 ${colors.bg}`}>
                  <div className={`h-2.5 w-2.5 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
                  <span className={`text-sm font-semibold ${colors.text}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className={`ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${colors.bg} ${colors.text}`}>
                    {tasks.length}
                  </span>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] flex-1 space-y-2 rounded-lg border border-dashed p-2 transition-colors ${
                        snapshot.isDraggingOver
                          ? 'border-gold/40 bg-gold/5'
                          : 'border-border bg-sidebar/50'
                      }`}
                    >
                      {tasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                            >
                              <TaskCard
                                task={task}
                                isDragging={dragSnapshot.isDragging}
                                onClick={() => setSelectedTask(task)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Create task modal */}
      {showCreateModal && (
        <TaskModal
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}
