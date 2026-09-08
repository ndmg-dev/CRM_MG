import type { ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { fmtRelative } from '../lib/format'
import type { InsightCounts } from '../lib/types'

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`vm-card ${className ?? ''}`}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  )
}

type Tone = 'ok' | 'warn' | 'bad' | 'neutral'

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`vm-badge ${tone}`}>
      <span className="dot" />
      {children}
    </span>
  )
}

export function Bar({ pct, tone = 'ok' }: { pct: number | null | undefined; tone?: Tone }) {
  const clamped = Math.max(0, Math.min(100, pct ?? 0))
  const color =
    tone === 'bad' ? 'var(--vm-bad)' : tone === 'warn' ? 'var(--vm-warn)' : 'var(--vm-gold)'
  return (
    <div className="vm-bar">
      <span style={{ width: `${clamped}%`, background: color }} />
    </div>
  )
}

export function pctTone(pct: number | null | undefined): Tone {
  if (pct == null) return 'neutral'
  if (pct >= 90) return 'bad'
  if (pct >= 75) return 'warn'
  return 'ok'
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="vm-state-msg">
      <Loader2 className="vm-inline-spin" size={22} style={{ display: 'inline' }} />
      <div style={{ marginTop: 8 }}>{label}</div>
    </div>
  )
}

export function ErrorMsg({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : 'Erro ao carregar os dados.'
  return (
    <div className="vm-state-msg error">
      <AlertTriangle size={22} style={{ display: 'inline' }} />
      <div style={{ marginTop: 8 }}>{msg}</div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="vm-state-msg">{children}</div>
}

export function SeverityPills({ counts }: { counts: InsightCounts | undefined }) {
  const c = counts ?? { critical: 0, warning: 0, info: 0 }
  const total = c.critical + c.warning + c.info
  if (total === 0) {
    return <span className="vm-sev-pill info">Tudo ok</span>
  }
  return (
    <div className="vm-sev-pills">
      {(['critical', 'warning', 'info'] as const).map((sev) => (
        <span key={sev} className={`vm-sev-pill ${c[sev] > 0 ? sev : 'muted'}`}>
          <span className="n">{c[sev]}</span>
          {sev === 'critical' ? 'críticos' : sev === 'warning' ? 'atenção' : 'info'}
        </span>
      ))}
    </div>
  )
}

// Indicador de frescor — recebe o `dataUpdatedAt` do useQuery (epoch ms).
export function Freshness({ updatedAt, fetching }: { updatedAt: number | undefined; fetching?: boolean }) {
  if (!updatedAt || !Number.isFinite(updatedAt)) return null
  return (
    <span className="vm-metric-label" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
      {fetching ? 'atualizando…' : `atualizado ${fmtRelative(new Date(updatedAt).toISOString())}`}
    </span>
  )
}
