import type { ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

export function Card({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`ex-card ${className ?? ''}`}>
      {(title || action) && (
        <div className="ex-card-head">
          {title && <h3>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Kpi({ label, value, hint, tone = 'neutral' }: { label: string; value: ReactNode; hint?: string; tone?: 'neutral' | 'ret' | 'apo' | 'warn' }) {
  return (
    <div className={`ex-kpi ${tone}`}>
      <div className="ex-kpi-label">{label}</div>
      <div className="ex-kpi-value">{value}</div>
      {hint && <div className="ex-kpi-hint">{hint}</div>}
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

export function Empty({ children }: { children: ReactNode }) {
  return <div className="ex-state">{children}</div>
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="ex-skeleton">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ex-skeleton-row" />
      ))}
    </div>
  )
}
