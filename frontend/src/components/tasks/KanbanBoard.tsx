import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Plus, Filter, Inbox } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import {
  applyQuickFilters,
  hasQuickFilters,
  isTarefaVencida,
  type QuickFilters,
} from '@/lib/taskFilters'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'
import TaskStats from './TaskStats'
import TaskDetailDrawer from './TaskDetailDrawer'
import TaskListView from './TaskListView'
import TaskCalendarView from './TaskCalendarView'
import TaskFilterBar from './TaskFilterBar'
import toast from 'react-hot-toast'
import type { Tarefa, StatusTarefa, TaskFilters } from '@/types'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_EMPTY_STATE,
  KANBAN_COLUMNS,
} from '@/lib/constants'

type BoardView = 'quadro' | 'lista' | 'prazos'

const VIEWS: Array<{ id: BoardView; label: string }> = [
  { id: 'quadro', label: 'Quadro' },
  { id: 'lista', label: 'Lista' },
  { id: 'prazos', label: 'Prazos' },
]

/** Alternador de visão. Mesmo conjunto de tarefas, três leituras. */
function ViewSwitch({ value, onChange }: { value: BoardView; onChange: (v: BoardView) => void }) {
  return (
    <div role="tablist" aria-label="Visão do quadro" className="flex h-8 items-center gap-0.5 rounded-lg border border-border bg-surface-raised p-0.5">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={value === v.id}
          onClick={() => onChange(v.id)}
          className={`h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors ${
            value === v.id
              ? 'bg-gold text-background'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

export default function KanbanBoard() {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  useEffect(() => { setCurrentPage('Tarefas') }, [setCurrentPage])

  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isManager = user?.perfil === 'ADMIN' || user?.perfil === 'COORDENADOR'
  const isAdmin = user?.perfil === 'ADMIN'

  const [selectedTask, setSelectedTask] = useState<Tarefa | null>(null)
  const [editingTask, setEditingTask] = useState<Tarefa | null>(null)
  /** Status com que o modal de criação abre; `null` = modal fechado. */
  const [createStatus, setCreateStatus] = useState<StatusTarefa | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({})
  const [quick, setQuick] = useState<QuickFilters>({})
  const [view, setView] = useState<BoardView>('quadro')

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ['tarefas', filters],
    queryFn: () => api.tarefas.getAll(Object.keys(filters).length > 0 ? filters : undefined),
  })

  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => api.setores.getAll(),
  })

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.usuarios.getAll(),
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

  // Os chips são aplicados no cliente, sobre o que o servidor já filtrou.
  const visibleTarefas = applyQuickFilters(tarefas, quick, user?.id)

  const overdueCount = tarefas.filter(isTarefaVencida).length

  const getColumnTasks = (status: StatusTarefa) =>
    visibleTarefas.filter((t) => t.status === status)

  const hasActiveFilters = Object.values(filters).some(Boolean) || hasQuickFilters(quick)

  // Nome dos setores cadastrados pelo admin, para as pills do card.
  const nomeSetor = Object.fromEntries(setores.map((s) => [s.codigo, s.nome]))

  /**
   * Ação do estado vazio de cada coluna. "Cobrar cliente" e "Nova tarefa"
   * abrem a criação já no status da coluna; "Ver pendentes" filtra o quadro;
   * "Ver auditoria" só existe para quem tem a rota.
   */
  const emptyStateAction = (status: StatusTarefa): (() => void) | undefined => {
    switch (status) {
      case 'PENDENTE':
      case 'AGUARDANDO_CLIENTE':
        return isManager ? () => setCreateStatus(status) : undefined
      case 'EM_PROCESSAMENTO':
        // Filtrar o quadro por PENDENTE esvaziaria as outras colunas; a lista
        // é a leitura certa para "ver pendentes".
        return () => {
          setFilters((f) => ({ ...f, status: 'PENDENTE' }))
          setShowFilters(true)
          setView('lista')
        }
      case 'CONCLUIDO':
        return isAdmin ? () => navigate('/auditoria') : undefined
    }
  }

  if (isLoading) return <LoadingSpinner label="Carregando tarefas..." />

  return (
    <div>
      <PageHeader
        title="Quadro de Tarefas"
        description="Gerencie as obrigações e demandas internas"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitch value={view} onChange={setView} />
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-1 h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-background">
                  !
                </span>
              )}
            </Button>
            {isManager && (
              <Button size="sm" onClick={() => setCreateStatus('PENDENTE')}>
                <Plus className="mr-1 h-4 w-4" />
                Nova Tarefa
              </Button>
            )}
          </div>
        }
      />

      <TaskStats tarefas={tarefas} user={user} nomeSetor={nomeSetor} />

      {/* Filters bar */}
      {showFilters && (
        <TaskFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          quick={quick}
          onQuickChange={setQuick}
          setores={setores}
          usuarios={usuarios}
          isAdmin={isAdmin}
          visibleCount={visibleTarefas.length}
          totalCount={tarefas.length}
          overdueCount={overdueCount}
        />
      )}

      {view === 'lista' && (
        <TaskListView
          tarefas={visibleTarefas}
          nomeSetor={nomeSetor}
          onSelect={setSelectedTask}
        />
      )}

      {view === 'prazos' && (
        <TaskCalendarView
          tarefas={visibleTarefas}
          nomeSetor={nomeSetor}
          onSelect={setSelectedTask}
        />
      )}

      {/* Kanban columns */}
      {view === 'quadro' && (
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {KANBAN_COLUMNS.map((status) => {
            const tasks = getColumnTasks(status)
            const colors = STATUS_COLORS[status]

            const empty = STATUS_EMPTY_STATE[status]
            const onEmptyAction = emptyStateAction(status)

            return (
              <div key={status} className="flex flex-col">
                {/* Cabeçalho: sem fundo colorido — a cor fica no ponto e na
                    contagem, para não competir com os cards. */}
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colors.dot}`} aria-hidden="true" />
                  <span className="truncate text-[13px] font-semibold text-text-primary">
                    {STATUS_LABELS[status]}
                  </span>
                  <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${colors.bg} ${colors.text}`}>
                    {tasks.length}
                  </span>
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => setCreateStatus(status)}
                      title={`Nova tarefa em ${STATUS_LABELS[status]}`}
                      aria-label={`Nova tarefa em ${STATUS_LABELS[status]}`}
                      className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Droppable area */}
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] flex-1 space-y-2 rounded-xl border border-dashed p-2 transition-colors ${
                        snapshot.isDraggingOver
                          ? 'border-gold-border bg-gold-soft'
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
                                setorLabel={nomeSetor[task.setorOrigem]}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Coluna vazia explica o que entra ali, em vez de só
                          uma moldura pontilhada. Some durante o arrasto para
                          não disputar espaço com o alvo de soltura. */}
                      {tasks.length === 0 && !snapshot.isDraggingOver && (
                        <EmptyState
                          size="sm"
                          icon={Inbox}
                          title={empty.title}
                          description={empty.description}
                          actionLabel={onEmptyAction ? empty.actionLabel : undefined}
                          onAction={onEmptyAction}
                        />
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>
      )}

      {/* Task detail drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          setorLabel={nomeSetor[selectedTask.setorOrigem]}
          isMoving={statusMutation.isPending}
          onClose={() => setSelectedTask(null)}
          onEdit={() => {
            setEditingTask(selectedTask)
            setSelectedTask(null)
          }}
          onMoveStatus={(status) => {
            statusMutation.mutate({ id: selectedTask.id, status })
            // Mesma mutation otimista do arrasto; o painel acompanha na hora.
            setSelectedTask({ ...selectedTask, status })
          }}
        />
      )}

      {/* Task edit modal */}
      {editingTask && (
        <TaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* Create task modal */}
      {createStatus && (
        <TaskModal
          initialStatus={createStatus}
          onClose={() => setCreateStatus(null)}
        />
      )}
    </div>
  )
}
