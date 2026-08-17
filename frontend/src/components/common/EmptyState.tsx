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
  /** `sm` cabe dentro de uma coluna do kanban; `default` ocupa a página. */
  size?: 'sm' | 'default'
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  size = 'default',
}: EmptyStateProps) {
  const compact = size === 'sm'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center text-center ${compact ? 'px-3 py-7' : 'py-12'}`}
    >
      <div
        className={`flex items-center justify-center rounded-lg bg-surface ${
          compact ? 'mb-2 h-9 w-9' : 'mb-3 h-11 w-11'
        }`}
      >
        <Icon className={compact ? 'h-4 w-4 text-text-muted' : 'h-5 w-5 text-text-muted'} aria-hidden="true" />
      </div>
      <h3 className={`mb-1 font-semibold text-text-secondary ${compact ? 'text-[13px]' : 'text-[14px]'}`}>
        {title}
      </h3>
      {description && (
        <p className={`text-[12px] text-text-muted ${compact ? 'mb-3 max-w-[26ch]' : 'mb-4 max-w-sm'}`}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" variant={compact ? 'secondary' : 'default'}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  )
}
