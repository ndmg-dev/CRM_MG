import { useMemo, useState } from 'react'
// Aliased: `Map` colidiria com o Map nativo usado na agregação abaixo.
import { Map as MapView, Heatmap, type HeatPoint, type HeatHoverInfo } from '../map/Map'
import type { TimeLog } from '../../hooks/useTimeLogs'
import type { Employee } from '../../hooks/useEmployees'
import { hasMeasuredLocation } from '../../utils/location'

/** Casas decimais usadas para agrupar batidas no mesmo ponto (~11 m). */
const GRID_PRECISION = 4

interface Props {
  logs: Pick<TimeLog, 'address' | 'latitude' | 'longitude' | 'employee_id'>[]
  employees: Employee[]
}

/**
 * Densidade geográfica das batidas do dia.
 *
 * Batidas repetidas no mesmo lugar são agregadas num único ponto com peso, em
 * vez de empilhadas como features idênticas: o heatmap do MapLibre satura no
 * peso acumulado, então 69 features sobrepostas e 1 feature de peso 69 pintam
 * igual — mas a versão agregada envia dezenas de pontos em vez de centenas.
 * Cada ponto carrega também quem bateu ponto ali, para o hover.
 */
export default function PunchHeatmap({ logs, employees }: Props) {
  const [tilesFailed, setTilesFailed] = useState(false)
  const [hover, setHover] = useState<HeatHoverInfo | null>(null)

  const points = useMemo<HeatPoint[]>(() => {
    const nameById = new Map(employees.map(e => [e.id, e.name]))
    const buckets = new Map<string, { latitude: number; longitude: number; weight: number; names: Set<string> }>()
    for (const log of logs) {
      if (!hasMeasuredLocation(log)) continue
      const key = `${log.latitude!.toFixed(GRID_PRECISION)},${log.longitude!.toFixed(GRID_PRECISION)}`
      const name = nameById.get(log.employee_id) ?? 'Funcionário removido'
      const hit = buckets.get(key)
      if (hit) { hit.weight += 1; hit.names.add(name) }
      else buckets.set(key, { latitude: log.latitude!, longitude: log.longitude!, weight: 1, names: new Set([name]) })
    }
    return Array.from(buckets.values()).map(b => ({ ...b, names: Array.from(b.names) }))
  }, [logs, employees])

  const center = useMemo<[number, number]>(
    () => (points.length ? [points[0].longitude, points[0].latitude] : [0, 0]),
    [points],
  )

  if (!points.length) {
    return <div className="chart-empty">Nenhuma batida com GPS neste dia.</div>
  }
  if (tilesFailed) {
    return <div className="chart-empty">Mapa indisponível no momento.</div>
  }

  const total = points.reduce((sum, p) => sum + (p.weight ?? 1), 0)
  // Sem medida prévia do próprio tooltip: clampa por quadrante (metade
  // esquerda abre pra direita, metade de baixo abre pra cima) em vez de
  // tentar centralizar exatamente sob o cursor.
  const openLeft = hover ? hover.x > hover.containerWidth / 2 : false
  const openUp = hover ? hover.y > hover.containerHeight / 2 : false
  const MAX_NAMES = 6

  return (
    <div className="heatmap-wrap">
      {/* key força uma instância nova quando o dia muda: o <Map> lê center/zoom
          só na construção, então reaproveitar a instância deixaria o
          enquadramento preso no dia anterior. */}
      <MapView
        key={center.join(',')}
        center={center}
        zoom={15}
        height={260}
        interactive
        onError={() => setTilesFailed(true)}
      >
        <Heatmap points={points} onHoverPoint={setHover} />

        {hover && (
          <div
            className="heatmap-tip"
            style={{
              left: openLeft ? undefined : hover.x + 14,
              right: openLeft ? hover.containerWidth - hover.x + 14 : undefined,
              top: openUp ? undefined : hover.y + 14,
              bottom: openUp ? hover.containerHeight - hover.y + 14 : undefined,
            }}
          >
            <div className="heatmap-tip-count">
              {hover.weight} batida{hover.weight === 1 ? '' : 's'}
            </div>
            <ul className="heatmap-tip-names">
              {hover.names.slice(0, MAX_NAMES).map(n => <li key={n}>{n}</li>)}
              {hover.names.length > MAX_NAMES && (
                <li className="heatmap-tip-more">+{hover.names.length - MAX_NAMES}</li>
              )}
            </ul>
          </div>
        )}
      </MapView>

      <div className="heatmap-legend">
        <span className="heatmap-legend-label">menos</span>
        <span className="heatmap-legend-ramp" aria-hidden="true" />
        <span className="heatmap-legend-label">mais</span>
        <span className="heatmap-legend-total">
          {total} batida{total === 1 ? '' : 's'} com GPS
        </span>
      </div>
    </div>
  )
}
