/**
 * Regra única de "esta batida tem localização medida?".
 *
 * Tabela, gráfico de locais e mapa de calor precisam concordar: uma batida sem
 * coordenadas não tem localização, mesmo que carregue um `address`. Registros
 * antigos podem trazer o endereço da empresa gravado por um fallback de
 * geocodificação que rodava quando o GPS falhava (removido em
 * checkin_service.py) — exibi-los como se fossem posição medida faria uma
 * batida sem GPS parecer idêntica a uma medida de fato no escritório.
 */

export const NO_LOCATION = 'Sem localização'

export interface MeasurableLog {
  address?: string
  latitude?: number
  longitude?: number
}

export interface MeasuredPoint {
  latitude: number
  longitude: number
  address?: string
}

export function hasMeasuredLocation(log: MeasurableLog): boolean {
  return typeof log.latitude === 'number' && typeof log.longitude === 'number'
}

/** Só devolve o endereço quando ele é sustentado por coordenadas reais. */
export function measuredAddress(log: MeasurableLog): string | undefined {
  return hasMeasuredLocation(log) ? log.address : undefined
}

export function measuredPoints(logs: MeasurableLog[]): MeasuredPoint[] {
  return logs
    .filter(hasMeasuredLocation)
    .map(l => ({ latitude: l.latitude!, longitude: l.longitude!, address: l.address }))
}

// Endereços vêm de geocodificação reversa ("Rua, Número, Bairro, Cidade, ...")
// e variam ponto a ponto pela precisão do GPS. Truncamos para rua + bairro
// (removendo número/complemento) para agrupar batidas do mesmo lugar.
export function truncateAddress(address?: string): string {
  if (!address) return NO_LOCATION
  const parts = address.split(',').map(p => p.trim()).filter(p => p && !/^\d+$/.test(p))
  return parts.slice(0, 2).join(', ') || address
}

/** Rótulo de agrupamento do gráfico de locais. */
export function locationKey(log: MeasurableLog): string {
  return truncateAddress(measuredAddress(log))
}
