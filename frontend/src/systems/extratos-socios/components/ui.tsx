import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Loader2 } from 'lucide-react'

export type Tone = 'gold' | 'ret' | 'apo' | 'warn' | 'neutral'

export function Card({ title, sub, action, children, className }: { title?: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`ex-card ${className ?? ''}`}>
      {(title || action) && (
        <div className="ex-card-head">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <p className="ex-card-sub">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Kpi({
  icon: Icon,
  tone = 'neutral',
  value,
  label,
  sub,
  delta,
  deltaTone = 'neutral',
}: {
  icon: LucideIcon
  tone?: Tone
  value: ReactNode
  label: string
  sub?: string
  delta?: string
  deltaTone?: Tone
}) {
  return (
    <div className="ex-kpi">
      <div className="ex-kpi-top">
        <span className={`ex-kpi-chip ${tone}`}>
          <Icon size={18} />
        </span>
        {delta && <span className={`ex-kpi-delta ${deltaTone}`}>{delta}</span>}
      </div>
      <div className="ex-kpi-value">{value}</div>
      <div className="ex-kpi-label">{label}</div>
      {sub && <div className="ex-kpi-sub">{sub}</div>}
    </div>
  )
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="ex-state">
      <Loader2 className="ex-spin" size={22} />
      <div>{label}</div>
    </div>
  )
}

export function ErrorMsg({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : 'Erro ao carregar os dados.'
  return (
    <div className="ex-state error">
      <AlertTriangle size={22} />
      <div>{msg}</div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, tone = 'neutral' }: { icon: LucideIcon; title: string; children?: ReactNode; tone?: Tone }) {
  return (
    <div className="ex-empty">
      <span className={`ex-empty-icon ${tone}`}>
        <Icon size={38} strokeWidth={1.5} />
      </span>
      <div className="ex-empty-title">{title}</div>
      {children && <div className="ex-empty-text">{children}</div>}
    </div>
  )
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={`ex-sk ${className ?? ''}`} style={style} />
}
