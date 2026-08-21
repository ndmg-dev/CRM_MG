import type { TimeLog } from '../hooks/useTimeLogs'
import { Modal } from './Modal'
import Badge from './Badge'
import { formatDate, formatTime } from '../utils/date'
import { TYPE_LABELS, STATUS_LABELS } from '../utils/labels'

export default function LogDetailModal({ log, onClose }: { log: TimeLog; onClose: () => void }) {
  const row = (label: string, value: React.ReactNode) => value ? (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 11, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', minWidth: 130, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#fff', wordBreak: 'break-all' }}>{value}</div>
    </div>
  ) : null

  const qualityColor = (q?: string) => q === 'ALTA' ? '#10B981' : q === 'MEDIA' ? '#F59E0B' : '#EF4444'

  return (
    <Modal open={true} onClose={onClose} title="Detalhes do registro" maxWidth={500}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Badge variant={log.status === 'VERIFICADO' ? 'ok' : log.status === 'JUSTIFICADO' ? 'neutral' : 'warn'}>
          {STATUS_LABELS[log.status] ?? log.status}
        </Badge>
        <span style={{ fontSize: 13, color: 'var(--mg-muted)' }}>{TYPE_LABELS[log.type] ?? log.type}</span>
        <span style={{ fontSize: 13, color: 'var(--mg-gold)', fontWeight: 600 }}>
          {formatDate(log.created_at)} {formatTime(log.created_at)}
        </span>
      </div>

      {row('📍 Endereço', log.address || <span style={{ color: 'var(--mg-muted)', opacity: 0.5 }}>Não capturado</span>)}
      {row('🌐 Coordenadas', (log.latitude != null && log.longitude != null)
        ? <a href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`} target="_blank" rel="noreferrer"
            style={{ color: 'var(--mg-gold)' }}>
            {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)} ↗
          </a>
        : null)}
      {row('📶 Wi-Fi (BSSID)', log.wifi_bssid)}
      {row('✅ Validação', log.validation_method && `${log.validation_method} — ${log.validation_detail}`)}
      {row('👤 Biometria',
        log.face_confidence != null
          ? <span style={{ color: qualityColor(log.face_match_quality) }}>
              {log.face_match_quality} ({((1 - log.face_confidence) * 100).toFixed(1)}% confiança)
            </span>
          : null
      )}
      {row('🖥 Dispositivo', log.device_user_agent)}
      {row('🌍 IP', log.device_ip)}
      {row('🕐 Fuso do dispositivo', log.device_timezone)}
      {row('⏱ Dif. servidor/cliente',
        log.server_client_time_diff_seconds != null
          ? `${log.server_client_time_diff_seconds > 0 ? '+' : ''}${log.server_client_time_diff_seconds}s`
          : null
      )}
      {row('📱 Kiosk', log.kiosk_id)}
      {row('🔌 Conexão', log.connection_type)}
      {log.notes && row('📝 Obs.', log.notes)}

      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  )
}
