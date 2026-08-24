import Badge from './Badge'
import { formatDateTime } from '../utils/date'

interface TimeLog {
  id: string
  type: string
  status: string
  created_at: string
  face_confidence?: number
  face_match_quality?: string
  validation_method?: string
  validation_detail?: string
  device_ip?: string
  kiosk_id?: string
  latitude?: number
  longitude?: number
  address?: string
}

const STATUS_VARIANT: Record<string, 'ok' | 'warn' | 'err' | 'neutral'> = {
  VERIFICADO: 'ok',
  JUSTIFICADO: 'neutral',
  PENDENTE: 'warn',
  WIFI_DESCONHECIDO: 'warn',
  FORA_DO_LOCAL: 'err',
}

const TYPE_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA_ALMOCO: 'Saída almoço',
  RETORNO_ALMOCO: 'Retorno almoço',
  SAIDA: 'Saída',
  SAIDA_INTERVALO: 'Saída intervalo',
  RETORNO_INTERVALO: 'Retorno intervalo',
}

function confidenceVariant(score: number): 'ok' | 'warn' | 'err' {
  const similarity = 1 - score
  if (similarity >= 0.65) return 'ok'
  if (similarity >= 0.50) return 'warn'
  return 'err'
}

export default function TimeLogDetail({ log }: { log: TimeLog }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Row label="Tipo" value={TYPE_LABEL[log.type] ?? log.type} />
      <Row label="Status" value={<Badge variant={STATUS_VARIANT[log.status] ?? 'neutral'}>{log.status}</Badge>} />
      <Row label="Horário" value={formatDateTime(log.created_at)} />
      {log.face_confidence !== undefined && (
        <Row
          label="Confiança facial"
          value={
            <Badge variant={confidenceVariant(log.face_confidence)}>
              {((1 - log.face_confidence) * 100).toFixed(1)}% ({log.face_match_quality})
            </Badge>
          }
        />
      )}
      {log.validation_method && <Row label="Validação" value={`${log.validation_method}: ${log.validation_detail}`} />}
      {log.device_ip && <Row label="IP" value={log.device_ip} />}
      {log.kiosk_id && <Row label="Kiosk" value={log.kiosk_id} />}
      {log.address && <Row label="Endereço" value={log.address} />}
      {log.latitude && <Row label="Coords" value={`${log.latitude}, ${log.longitude}`} />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--mg-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--mg-white)' }}>{value}</span>
    </div>
  )
}
