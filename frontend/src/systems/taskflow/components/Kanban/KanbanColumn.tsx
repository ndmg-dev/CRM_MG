import { Droppable } from '@hello-pangea/dnd'
import KanbanCard from './KanbanCard'
import { TriangleAlert } from 'lucide-react'

const WIP_LIMIT = 5

const columnColors: Record<string, string> = {
  'Backlog': '#6366f1',
  'To Do': '#8b5cf6',
  'In Progress': '#3b82f6',
  'In Review': '#f59e0b',
  'Done': '#22c55e',
}

interface KanbanColumnProps {
  id: string
  title: string
  tickets: any[]
  onEditCard: (ticket: any) => void
  onDeleteCard: (ticketId: string) => void
}

export default function KanbanColumn({ id, title, tickets, onEditCard, onDeleteCard }: KanbanColumnProps) {
  const isWipViolation = (title !== 'Done' && title !== 'Backlog') && tickets.length > WIP_LIMIT
  const color = columnColors[title] || '#6366f1'

  return (
    <Droppable droppableId={id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`kanban-column ${isWipViolation ? 'wip-alert' : ''}`}
          style={{
            borderColor: snapshot.isDraggingOver ? 'var(--color-accent-gold)' : undefined,
            background: snapshot.isDraggingOver ? 'rgba(212,168,83,0.03)' : undefined,
          }}
        >
          {/* Column Header */}
          <div
            style={{
              padding: '16px 16px 12px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 8px ${color}60`,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {title}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isWipViolation && (
                <span title={`WIP Limit excedido! (${tickets.length}/${WIP_LIMIT})`} style={{ display: 'flex' }}>
                  <TriangleAlert
                    size={16}
                    style={{ color: 'var(--color-danger)' }}
                    className="animate-pulse-danger"
                  />
                </span>
              )}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isWipViolation ? 'var(--color-danger)' : 'var(--color-text-muted)',
                  background: isWipViolation ? 'var(--color-danger-soft)' : 'var(--color-bg-primary)',
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {tickets.length}
              </span>
            </div>
          </div>

          {/* Cards */}
          <div
            style={{
              padding: 8,
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minHeight: 60,
            }}
          >
            {tickets.length === 0 && (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--color-border)',
                }}
              >
                Arraste tickets aqui
              </div>
            )}
            {tickets.map((ticket, index) => (
              <KanbanCard
                key={ticket.id}
                ticket={ticket}
                index={index}
                onEdit={() => onEditCard(ticket)}
                onDelete={() => onDeleteCard(ticket.id)}
              />
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  )
}
