import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Map, Marker } from '../map/Map'
import { hasMeasuredLocation } from '../../utils/location'

/** map-pin do Feather — mesmo traço (24×24, strokeWidth 2) dos ícones da sidebar. */
export function MapPinIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

const PANEL_W = 320
const PANEL_H = 296
/** Espera antes de instanciar o mapa: evita criar/destruir WebGL a cada linha
 *  que o cursor atravessa ao percorrer a tabela. */
const HOVER_DELAY_MS = 200

interface Props {
  address?: string
  latitude?: number
  longitude?: number
}

export default function LocationCell({ address, latitude, longitude }: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [tilesFailed, setTilesFailed] = useState(false)

  const hasCoords = hasMeasuredLocation({ latitude, longitude })

  const close = useCallback(() => {
    window.clearTimeout(timerRef.current)
    setPos(null)
  }, [])

  const open = useCallback(() => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      // Posição fixa calculada na abertura: o painel vai para um portal no
      // body, então não é recortado pelo overflow do card nem da página.
      const left = Math.min(Math.max(rect.left, 12), window.innerWidth - PANEL_W - 12)
      const below = rect.bottom + 8
      const top = below + PANEL_H > window.innerHeight - 12
        ? Math.max(12, rect.top - PANEL_H - 8)
        : below
      setPos({ top, left })
    }, HOVER_DELAY_MS)
  }, [])

  // Painel é `position: fixed` a partir de um retângulo capturado uma vez —
  // rolar ou redimensionar o descolaria da linha de origem.
  useEffect(() => {
    if (!pos) return
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [pos, close])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  // Sem coordenadas não há localização a exibir, mesmo que exista `address`:
  // registros antigos podem carregar o endereço da empresa gravado por um
  // fallback de geocodificação (ver utils/location.ts). Mostrá-lo aqui faria
  // uma batida sem GPS parecer medida no escritório.
  if (!hasCoords) {
    return <span className="loc-empty" title="Batida sem coordenadas GPS">Sem GPS</span>
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="loc-trigger"
        tabIndex={0}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onKeyDown={e => e.key === 'Escape' && close()}
      >
        <span className="loc-pin" aria-hidden="true"><MapPinIcon /></span>
        <span className="loc-text">{address ?? `${latitude!.toFixed(5)}, ${longitude!.toFixed(5)}`}</span>
      </span>

      {pos && createPortal(
        <div className="loc-panel" style={{ top: pos.top, left: pos.left, width: PANEL_W }} role="tooltip">
          <div className="loc-panel-head">
            <span className="loc-panel-icon"><MapPinIcon size={12} /></span>
            Local da batida
          </div>

          <div className="loc-panel-map">
            {tilesFailed ? (
              <div className="loc-panel-fallback">Mapa indisponível no momento</div>
            ) : (
              <Map center={[longitude!, latitude!]} zoom={16} height={168} onError={() => setTilesFailed(true)}>
                <Marker longitude={longitude!} latitude={latitude!} />
              </Map>
            )}
          </div>

          <div className="loc-panel-body">
            {address && <div className="loc-panel-address">{address}</div>}
            <div className="loc-panel-coords">
              {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
