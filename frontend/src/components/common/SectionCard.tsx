import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  /** Rótulo do painel — renderizado em caixa alta, como no sistema de ponto. */
  title?: string
  /** Ações contextuais alinhadas à direita do cabeçalho. */
  actions?: ReactNode
  /** Remove o padding interno (para painéis puramente tabulares). */
  flush?: boolean
  className?: string
  children: ReactNode
}

/**
 * Superfície padrão do CRM: uma única área com borda discreta e raio de 12px.
 * Substitui o padrão anterior de `<h2>` solto seguido de uma `div` bordada.
 */
export default function SectionCard({
  title,
  actions,
  flush = false,
  className,
  children,
}: SectionCardProps) {
  return (
    <section className={cn('rounded-xl border border-border bg-card', className)}>
      {(title || actions) && (
        <div className="flex h-11 items-center justify-between gap-3 border-b border-border px-4">
          {title && (
            <h2 className="truncate text-[11px] font-semibold uppercase tracking-label text-text-muted">
              {title}
            </h2>
          )}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  )
}
