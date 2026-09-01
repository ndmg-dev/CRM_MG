import type { ReactNode } from 'react'

/** Cor semântica do cartão — dirige o chip do ícone e (opcionalmente) o valor. */
export type Tone = 'ok' | 'err' | 'gold' | 'warn' | 'neutral'

interface Props {
  icon: ReactNode
  /** Tom do chip do ícone. */
  tone: Tone
  label: string
  value: ReactNode
  /** Tom do número. Sem isto, o valor herda o branco padrão. */
  valueTone?: Tone
  sub?: string
  /**
   * Com `onSelect` o cartão vira aba: um `<button>` que comanda a área de
   * detalhe abaixo da grade (ver Dashboard). Sem ele o cartão continua sendo
   * o bloco estático que Relatórios usa.
   */
  onSelect?: () => void
  /** Só com `onSelect`: marca a aba corrente (borda dourada + aria-selected). */
  active?: boolean
  /** Ponto verde ao lado do rótulo — dado que se atualiza sozinho. */
  live?: boolean
  /** Id do painel que esta aba controla, para aria-controls. */
  controls?: string
}

export default function MetricCard({
  icon, tone, label, value, valueTone, sub, onSelect, active, live, controls,
}: Props) {
  const body = (
    <>
      <div className={`kpi-icon tone-${tone}`} aria-hidden="true">{icon}</div>
      <div className="kpi-label">
        {label}
        {live && <span className="kpi-live" aria-hidden="true" />}
      </div>
      <div className={`kpi-value${valueTone ? ` tone-${valueTone}` : ''}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </>
  )

  // Aba: role="tab" num <button> — o teclado já navega por Tab entre eles e
  // Enter/Espaço seleciona, sem precisar de handler de setas.
  if (onSelect) {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={!!active}
        aria-controls={controls}
        className={`kpi-card kpi-card-tab${active ? ' is-active' : ''}`}
        onClick={onSelect}
      >
        {body}
      </button>
    )
  }

  return <div className="kpi-card">{body}</div>
}
