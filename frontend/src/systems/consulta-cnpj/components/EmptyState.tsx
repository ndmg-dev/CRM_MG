import Button from './Button'

interface EmptyStateProps {
  icon?: string
  title?: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export default function EmptyState({
  icon = '📭',
  title = 'Nenhum resultado',
  description = '',
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
