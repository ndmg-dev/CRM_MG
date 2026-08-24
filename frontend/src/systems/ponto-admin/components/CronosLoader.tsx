import { useId } from 'react'

const GOLD = '#d4a843'
const FADED = 0.42

type Props = { size?: number; label?: string }

/**
 * Loader da ampulheta do Cronos. Geometria e cores vêm de cronos-icon.svg sem
 * alteração — no frame 0 (cheio em cima) é idêntico ao ícone estático.
 * Anima só `transform`/`opacity` (composto em GPU); nunca os `points`.
 */
export function CronosLoader({ size = 96, label = 'Carregando' }: Props) {
  const uid = useId().replace(/:/g, '')
  const ct = `cr-ct-${uid}`
  const cb = `cr-cb-${uid}`

  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={label}>
      <defs>
        <clipPath id={ct}>
          <rect className="cr-top" x="20" y="18" width="60" height="28" />
        </clipPath>
        <clipPath id={cb}>
          <rect className="cr-bottom" x="20" y="50" width="60" height="28" />
        </clipPath>
      </defs>

      <g className="cr-glass">
        <polygon points="26,18 70,18 48,46" fill={GOLD} opacity={FADED} />
        <polygon points="26,78 70,78 48,50" fill={GOLD} opacity={FADED} />
        <polygon points="26,18 70,18 48,46" fill={GOLD} clipPath={`url(#${ct})`} />
        <polygon points="26,78 70,78 48,50" fill={GOLD} clipPath={`url(#${cb})`} />
        <g className="cr-stream">
          <rect x="47.3" y="45" width="1.4" height="6" fill={GOLD} />
        </g>
      </g>
    </svg>
  )
}

export default CronosLoader
