import type { ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { StatusEntrega } from '../types'
import { CLASSE_STATUS, ROTULO_STATUS, diasAte, rotuloPrazo } from '../lib/formato'

export function ChipStatus({ status }: { status: StatusEntrega }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${CLASSE_STATUS[status]}`}
    >
      {ROTULO_STATUS[status]}
    </span>
  )
}

/**
 * Trilho de prazo — a assinatura visual do protótipo. O marcador anda numa
 * janela de ±30 dias em torno do vencimento; o centro é o dia do prazo.
 */
export function TrilhoPrazo({ prazo, status }: { prazo: string; status: StatusEntrega }) {
  const dias = diasAte(prazo)
  const janela = 30
  const limitado = Math.max(-janela, Math.min(janela, dias))
  const pos = ((janela - limitado) / (janela * 2)) * 100

  const cor =
    status === 'ENTREGUE' ? 'bg-success'
    : dias < 0 ? 'bg-error'
    : dias <= 3 ? 'bg-warning'
    : 'bg-text-muted'

  return (
    <div className="w-28">
      <div className="relative h-1 rounded-full bg-surface">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border-light" />
        <div
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card ${cor}`}
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-1.5 font-mono text-[11px] leading-none text-text-muted">
        {rotuloPrazo(prazo, status)}
      </div>
    </div>
  )
}

export function Indicador({
  icone: Icone,
  valor,
  rotulo,
  tom = 'text-text-muted',
}: {
  icone: React.ComponentType<{ className?: string }>
  valor: number | string
  rotulo: string
  tom?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <Icone className={`h-5 w-5 shrink-0 ${tom}`} aria-hidden="true" />
      <div>
        <div className="font-mono text-2xl leading-none text-text-primary">{valor}</div>
        <div className="mt-1 text-xs text-text-muted">{rotulo}</div>
      </div>
    </div>
  )
}

export function Carregando({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-text-secondary">
      <Loader2 className="h-5 w-5 animate-spin text-gold" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

/** Erro de carregamento sem vazar detalhe técnico para a tela. */
export function ErroCarregamento({ erro }: { erro: unknown }) {
  const msg = erro instanceof Error ? erro.message : 'Erro inesperado'
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-error/30 bg-error-soft px-4 py-8 text-center">
      <AlertTriangle className="h-6 w-6 text-error" aria-hidden="true" />
      <p className="text-sm text-text-primary">Não foi possível carregar estes dados.</p>
      <p className="font-mono text-xs text-text-muted">{msg}</p>
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-text-secondary">{children}</div>
  )
}

export function Secao({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-divider px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">{titulo}</h2>
        {acao}
      </header>
      {children}
    </section>
  )
}
