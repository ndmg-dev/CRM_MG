import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-surface">
        <Icon className="h-5 w-5 text-text-muted" aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-[14px] font-semibold text-text-secondary">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-[12px] text-text-muted">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  )
}
