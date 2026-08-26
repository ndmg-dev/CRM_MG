import { Modal } from './Modal'
import Badge from './Badge'
import { formatDate, formatDateTime } from '../utils/date'
import { OCCURRENCE_TYPE_LABELS, JUSTIFICATION_STATUS_LABELS } from '../utils/labels'
import { openAttachment } from '../lib/api'

export interface JustificationDetail {
  id: string
  reason: string
  date: string
  occurrence_type?: string
  status: 'PENDENTE' | 'APROVADO' | 'REPROVADO'
  start_time?: string | null
  end_time?: string | null
  justified_hours?: number | null
  attachment_url?: string | null
  created_at: string
  created_by_name?: string | null
  reviewed_by_name?: string | null
  reviewed_at?: string | null
}

const STATUS_BADGE_VARIANT: Record<string, 'ok' | 'warn' | 'err'> = {
  APROVADO: 'ok', PENDENTE: 'warn', REPROVADO: 'err',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width: 110, flexShrink: 0, fontSize: 11, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: '#fff', flex: 1 }}>{children}</div>
    </div>
  )
}

export default function JustificationDetailModal({
  justification, employeeName, dateRangeLabel, onClose,
}: {
  justification: JustificationDetail
  employeeName: string
  /** Quando faz parte de um atestado de vários dias, o intervalo completo
   * (ex.: "19/08/2026 – 21/08/2026 (3 dias)") — sobrepõe a data única. */
  dateRangeLabel?: string
  onClose: () => void
}) {
  const j = justification
  const horario = j.start_time && j.end_time
    ? `${j.start_time.slice(0, 5)}–${j.end_time.slice(0, 5)}`
    : j.justified_hours != null ? `${j.justified_hours}h` : 'Dia inteiro'

  return (
    <Modal open={true} onClose={onClose} title="Detalhes da justificativa" maxWidth={440}>
      <div style={{ marginBottom: 4 }}>
        <Row label="Colaborador">{employeeName}</Row>
        <Row label="Data">{dateRangeLabel ?? formatDate(j.date)}</Row>
        <Row label="Tipo">{OCCURRENCE_TYPE_LABELS[j.occurrence_type ?? 'FALTA_INTEGRAL'] ?? j.occurrence_type}</Row>
        <Row label="Horário/Horas">{horario}</Row>
        <Row label="Motivo">
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{j.reason}</div>
        </Row>
        {j.attachment_url && (
          <Row label="Anexo">
            <button onClick={() => openAttachment(j.attachment_url!)}
              style={{ background: 'none', border: 'none', color: 'var(--mg-gold)', cursor: 'pointer', padding: 0, fontSize: 13 }}>
              📎 Ver anexo
            </button>
          </Row>
        )}
        <Row label="Status">
          <Badge variant={STATUS_BADGE_VARIANT[j.status]}>{JUSTIFICATION_STATUS_LABELS[j.status] ?? j.status}</Badge>
        </Row>
        <Row label="Lançado por">
          {j.created_by_name ?? '—'}
          <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 2 }}>{formatDateTime(j.created_at)}</div>
        </Row>
        {j.status !== 'PENDENTE' && (
          <Row label={j.status === 'APROVADO' ? 'Aprovado por' : 'Recusado por'}>
            {j.reviewed_by_name ?? '—'}
            {j.reviewed_at && (
              <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 2 }}>{formatDateTime(j.reviewed_at)}</div>
            )}
          </Row>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  )
}
