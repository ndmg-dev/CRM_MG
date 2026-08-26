import { useState } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import KanbanColumn from './KanbanColumn'
import CardModal from './CardModal'
import { useTickets } from '../../hooks/useTickets'
import { useDepartments } from '../../contexts/DepartmentContext'
import { PlusCircle, Building2 } from 'lucide-react'

export default function KanbanBoard() {
  const { current: department, currentId, loading: loadingDepts } = useDepartments()
  const {
    loading,
    error,
    columns,
    getTicketsByColumn,
    createTicket,
    updateTicket,
    moveTicket,
    deleteTicket,
  } = useTickets(currentId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<any>(null)

  const ticketsByColumn = getTicketsByColumn()

  // Reescrito de @dnd-kit/core+sortable pra @hello-pangea/dnd (decisão do
  // projeto de migração — ver docs/migracoes/handoff.md). Mesmo
  // comportamento do original: só dispara o PATCH de mover quando o ticket
  // muda de coluna (reorder dentro da mesma coluna não é persistido).
  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId !== destination.droppableId) {
      moveTicket(draggableId, destination.droppableId)
    }
  }

  const handleCreateTicket = async (data: any) => {
    await createTicket(data)
    setModalOpen(false)
  }

  const handleUpdateTicket = async (data: any) => {
    await updateTicket(editingTicket.id, data)
    setEditingTicket(null)
    setModalOpen(false)
  }

  const handleEditCard = (ticket: any) => {
    setEditingTicket(ticket)
    setModalOpen(true)
  }

  const handleDeleteCard = async (ticketId: string) => {
    if (window.confirm('Tem certeza que deseja remover este ticket?')) {
      await deleteTicket(ticketId)
    }
  }

  // Colaborador ainda sem setor vinculado
  if (!loadingDepts && !currentId) {
    return (
      <div style={{ padding: 64, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <Building2 size={44} style={{ opacity: 0.4, marginBottom: 16 }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--color-text-primary)' }}>
          Nenhum setor vinculado
        </h2>
        <p style={{ fontSize: 14, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
          Seu usuário ainda não faz parte de nenhum setor. Peça a um administrador para
          incluir você no Painel Admin → Setores.
        </p>
      </div>
    )
  }

  if (loading || loadingDepts) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ display: 'flex', gap: 20, overflow: 'auto' }}>
          {columns.map((col) => (
            <div key={col} style={{ minWidth: 280 }}>
              <div className="skeleton" style={{ height: 40, marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 100, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 100, marginBottom: 8 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        className="glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: '1px solid var(--color-border)',
          borderRadius: 0,
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', bottom: 0, left: 32, right: 32, height: 1, background: 'linear-gradient(90deg, rgba(212,168,83,0.2), transparent 80%)' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Kanban Board</h1>
            {department && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  padding: '3px 10px',
                  borderRadius: 999,
                  color: department.cor || 'var(--color-accent-gold)',
                  background: `${department.cor || '#d4a853'}1a`,
                  border: `1px solid ${department.cor || '#d4a853'}44`,
                }}
              >
                {department.nome}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {department
              ? `Gerencie as atividades do setor ${department.nome}`
              : 'Gerencie as atividades da sua equipe'}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setEditingTicket(null); setModalOpen(true) }}
          id="btn-new-ticket"
        >
          <PlusCircle size={18} />
          Novo Ticket
        </button>
      </div>

      {error && (
        <div
          style={{
            margin: '16px 32px 0',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            background: 'var(--color-danger-soft)',
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}

      {/* Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          style={{
            display: 'flex',
            gap: 16,
            padding: '20px 32px',
            overflow: 'auto',
            flex: 1,
          }}
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column}
              id={column}
              title={column}
              tickets={ticketsByColumn[column] || []}
              onEditCard={handleEditCard}
              onDeleteCard={handleDeleteCard}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Modal */}
      {modalOpen && (
        <CardModal
          ticket={editingTicket}
          departmentId={currentId}
          onSave={editingTicket ? handleUpdateTicket : handleCreateTicket}
          onClose={() => { setModalOpen(false); setEditingTicket(null) }}
        />
      )}
    </div>
  )
}
