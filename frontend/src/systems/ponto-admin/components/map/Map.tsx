import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'

/*
 * Primitivo de mapa no formato da mapcn (<Map> + <Marker>).
 *
 * A mapcn é distribuída como registry shadcn — o código é copiado para o
 * repositório, não instalado como pacote (o `mapcn` do npm é um name squat).
 * Como este admin é CSS puro, sem Tailwind/shadcn, a mesma ideia foi aplicada
 * à mão: a API declarativa da mapcn sobre o mesmo engine (MapLibre GL),
 * estilizada com os tokens do nosso design system.
 *
 * O bundle do MapLibre (~800 kB) fica fora do chunk principal: o engine e o
 * CSS dele só são importados no primeiro mapa efetivamente renderizado.
 */

/** Basemap escuro da CARTO — sem chave de API, casa com o tema do admin.
 *  Os hosts precisam estar liberados na CSP (ver frontend/admin/nginx.conf). */
const DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap · © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
}

const MapContext = createContext<MapLibreMap | null>(null)

/**
 * Quantos erros do MapLibre caracterizam "basemap indisponível".
 *
 * O evento `error` também dispara para falhas isoladas e inofensivas — um
 * tile ausente na borda do viewport, por exemplo. Um limiar separa esse ruído
 * do caso real (host bloqueado por CSP, offline, provedor fora do ar), em que
 * todos os tiles falham de uma vez.
 */
const ERROR_THRESHOLD = 4

interface MapProps {
  /** [longitude, latitude] — ordem GeoJSON, como na mapcn. */
  center: [number, number]
  zoom?: number
  height?: number | string
  /** Mapa de leitura (tooltip/preview) não deve capturar scroll nem arrasto. */
  interactive?: boolean
  children?: ReactNode
  /** Chamado quando o basemap não carrega (offline, CSP, provedor fora do ar). */
  onError?: () => void
}

export function Map({ center, zoom = 16, height = 180, interactive = false, children, onError }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    let instance: MapLibreMap | null = null
    let resizeObserver: ResizeObserver | null = null
    let cancelled = false

    void (async () => {
      const [{ Map: MapLibre }] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ])
      // O componente pode ter desmontado durante o import assíncrono.
      const container = containerRef.current
      if (cancelled || !container) return

      // `interactive: false` já desliga todos os handlers de gesto do
      // MapLibre — o preview não captura scroll nem arrasto da página.
      instance = new MapLibre({
        container,
        style: DARK_STYLE,
        center,
        zoom,
        interactive,
        // Não-compacta de propósito: a forma compacta esconde a atribuição
        // atrás de um botão "i", e o painel é `pointer-events: none` — não
        // haveria como abri-lo. OpenStreetMap e CARTO exigem crédito visível.
        attributionControl: { compact: false },
      })

      let errors = 0
      instance.on('error', () => {
        if (++errors === ERROR_THRESHOLD) onErrorRef.current?.()
      })

      // O container nasce dentro de uma tooltip cujo layout final (a altura
      // real de .loc-panel-map) só assenta um frame depois deste efeito
      // rodar — MapLibre só lê o tamanho do container na construção e não
      // volta a medir sozinho. Sem isto o canvas fica com o buffer do
      // primeiro layout (quadrado, largura×largura) e a imagem sai cortada.
      resizeObserver = new ResizeObserver(() => instance?.resize())
      resizeObserver.observe(container)

      setMap(instance)
    })()

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      instance?.remove()
      setMap(null)
    }
    // center/zoom são aplicados na criação; para movimentar um mapa já montado
    // use a instância via useMap(). Remontar a cada mudança seria caro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mapcn-root" style={{ height }}>
      <div ref={containerRef} className="mapcn-canvas" />
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </div>
  )
}

export function useMap() {
  return useContext(MapContext)
}

interface MarkerProps {
  longitude: number
  latitude: number
}

/** Marcador dourado, alinhado ao pin usado na tabela de pontos. */
export function Marker({ longitude, latitude }: MarkerProps) {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    let marker: { remove: () => void } | null = null
    let cancelled = false

    void (async () => {
      const { Marker: MapLibreMarker } = await import('maplibre-gl')
      if (cancelled) return
      const el = document.createElement('div')
      el.className = 'mapcn-marker'
      marker = new MapLibreMarker({ element: el }).setLngLat([longitude, latitude]).addTo(map)
    })()

    return () => {
      cancelled = true
      marker?.remove()
    }
  }, [map, longitude, latitude])

  return null
}

export interface HeatPoint {
  latitude: number
  longitude: number
  /** Peso do ponto — batidas agregadas no mesmo lugar contam mais. */
  weight?: number
  /** Quem bateu ponto neste ponto — aparece no hover. */
  names?: string[]
}

export interface HeatHoverInfo {
  /** Posição do cursor em pixels, relativa ao container do mapa. */
  x: number
  y: number
  /** Tamanho do container no momento do hover, para o tooltip clampar sozinho. */
  containerWidth: number
  containerHeight: number
  weight: number
  names: string[]
}

interface HeatmapProps {
  points: HeatPoint[]
  /** Enquadra o mapa nos pontos ao montar. */
  fitBounds?: boolean
  /** `null` quando o cursor sai da vizinhança de todo ponto. */
  onHoverPoint?: (info: HeatHoverInfo | null) => void
}

const SOURCE_ID = 'mapcn-heat-source'
const LAYER_ID = 'mapcn-heat-layer'
/** Camada gêmea, invisível, só para hit-test — heatmap não é "clicável" por
 *  feature (é densidade contínua), então o hover precisa de geometria real
 *  por baixo. O raio acompanha o do heatmap: hover ~= onde o brilho aparece. */
const PICK_LAYER_ID = 'mapcn-heat-pick-layer'
/** Nomes concatenados nas properties do GeoJSON (que só carrega primitivos
 *  de forma confiável através do round-trip do MapLibre) — nunca aparece
 *  literalmente num endereço, então é seguro como delimitador. */
const NAMES_SEP = '|||'

/**
 * Camada de densidade das batidas.
 *
 * A rampa vai do dourado do design system (baixa densidade) ao vermelho
 * (alta), pulando o azul/verde do heatmap padrão do MapLibre — que brigaria
 * com a paleta do admin e leria como "status ok" num gráfico que não fala de
 * status.
 */
export function Heatmap({ points, fitBounds = true, onHoverPoint }: HeatmapProps) {
  const map = useMap()
  const onHoverPointRef = useRef(onHoverPoint)
  onHoverPointRef.current = onHoverPoint

  useEffect(() => {
    if (!map || !points.length) return
    let cancelled = false

    const data: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: points.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: { weight: p.weight ?? 1, names: (p.names ?? []).join(NAMES_SEP) },
      })),
    }

    // Hoistados para fora de apply(): precisam da MESMA referência de função
    // na hora de desligar (map.off) no cleanup deste efeito.
    const handleMove = (e: { point: { x: number; y: number } }) => {
      // Tupla, não o objeto {x,y}: PointLike aceita array, mas não uma cópia
      // estrutural da classe Point (ela expõe métodos como clone/add/sub que
      // um objeto plano não tem, e o TS checa isso por estrutura).
      const features = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: [PICK_LAYER_ID] })
      if (!features.length) { onHoverPointRef.current?.(null); return }
      map.getCanvas().style.cursor = 'pointer'
      const names = new Set<string>()
      let weight = 0
      for (const f of features) {
        weight += Number(f.properties?.weight ?? 1)
        for (const n of String(f.properties?.names ?? '').split(NAMES_SEP)) {
          if (n) names.add(n)
        }
      }
      const { clientWidth, clientHeight } = map.getContainer()
      onHoverPointRef.current?.({
        x: e.point.x, y: e.point.y,
        containerWidth: clientWidth, containerHeight: clientHeight,
        weight, names: Array.from(names),
      })
    }
    const handleLeave = () => {
      map.getCanvas().style.cursor = ''
      onHoverPointRef.current?.(null)
    }

    const apply = () => {
      if (cancelled || !map.getStyle()) return

      const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
      if (existing) {
        existing.setData(data)
      } else {
        map.addSource(SOURCE_ID, { type: 'geojson', data })
        map.addLayer({
          id: LAYER_ID,
          type: 'heatmap',
          source: SOURCE_ID,
          paint: {
            'heatmap-weight': ['coalesce', ['get', 'weight'], 1],
            'heatmap-intensity': 1.1,
            'heatmap-radius': 26,
            'heatmap-opacity': 0.82,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.2, 'rgba(201,150,12,0.35)',
              0.45, 'rgba(216,184,102,0.65)',
              0.7, 'rgba(239,159,39,0.85)',
              1, 'rgba(226,75,74,0.95)',
            ],
          },
        })
        // Mesmo raio do heatmap-radius: a área hoverável casa com a área que
        // efetivamente brilha. Opacidade zero — existe só para hit-test;
        // queryRenderedFeatures devolve TODOS os pontos que se sobrepõem sob
        // o cursor, então batidas próximas (não só a exatamente sob o pixel)
        // entram juntas na mesma resposta de hover.
        map.addLayer({
          id: PICK_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: { 'circle-radius': 26, 'circle-opacity': 0, 'circle-stroke-width': 0 },
        })
        map.on('mousemove', PICK_LAYER_ID, handleMove)
        map.on('mouseleave', PICK_LAYER_ID, handleLeave)
      }

      if (fitBounds) {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
        for (const p of points) {
          minLng = Math.min(minLng, p.longitude); maxLng = Math.max(maxLng, p.longitude)
          minLat = Math.min(minLat, p.latitude); maxLat = Math.max(maxLat, p.latitude)
        }
        // Batidas de um único local colapsam a bbox num ponto: fitBounds
        // levaria o zoom ao máximo e o calor cobriria a tela inteira.
        if (maxLng - minLng < 1e-4 && maxLat - minLat < 1e-4) {
          map.jumpTo({ center: [minLng, minLat], zoom: 15 })
        } else {
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 36, duration: 0, maxZoom: 16 })
        }
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)

    return () => {
      cancelled = true
      onHoverPointRef.current?.(null)
      // O estilo some junto com a instância no unmount do <Map>; remover
      // listeners/camadas só importa quando este componente sai sozinho.
      if (!map.getStyle()) return
      map.off('mousemove', PICK_LAYER_ID, handleMove)
      map.off('mouseleave', PICK_LAYER_ID, handleLeave)
      if (map.getLayer(PICK_LAYER_ID)) map.removeLayer(PICK_LAYER_ID)
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map, points, fitBounds])

  return null
}
