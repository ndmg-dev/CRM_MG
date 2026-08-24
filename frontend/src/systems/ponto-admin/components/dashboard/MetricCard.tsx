import { useId, type ReactNode } from 'react'

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
   * Painel que expande sob o cartão no hover ou no foco por teclado. Quando
   * presente, o cartão vira um alvo focável e ganha affordance visual — sem
   * ele o cartão continua sendo conteúdo estático puro.
   */
  panel?: ReactNode
}

export default function MetricCard({ icon, tone, label, value, valueTone, sub, panel }: Props) {
  const panelId = useId()

  return (
    <div
      className={`kpi-card${panel ? ' kpi-card-expandable' : ''}`}
      tabIndex={panel ? 0 : undefined}
      aria-describedby={panel ? panelId : undefined}
    >
      <div className={`kpi-icon tone-${tone}`} aria-hidden="true">{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${valueTone ? ` tone-${valueTone}` : ''}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}

      {panel && (
        <>
          {/* Ponte invisível entre cartão e painel: sem ela o gap de 10px
              quebra o hover ao mover o mouse para dentro do painel. */}
          <div className="kpi-panel-bridge" aria-hidden="true" />
          <div className="kpi-panel" id={panelId} role="tooltip">{panel}</div>
        </>
      )}
    </div>
  )
}
