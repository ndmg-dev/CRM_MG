import type { Anomaly } from '../hooks/useReports'

interface Props {
  anomalies:    Anomaly[]
  onExportXlsx: () => void
  onOpenLog:    (logId: string) => void
}

const SEV_DOT: Record<string, { color: string; shadow: string }> = {
  critico:  { color: 'var(--mg-red)',   shadow: 'rgba(226,75,74,0.5)' },
  suspeito: { color: 'var(--mg-gold)',  shadow: 'rgba(201,150,12,0.4)' },
  atencao:  { color: 'var(--mg-green)', shadow: 'transparent' },
}

const SEV_LABEL: Record<string, string> = {
  critico: 'Crítico', suspeito: 'Suspeito', atencao: 'Atenção',
}

const JUST_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDENTE:  { label: 'Justificativa pendente', color: 'var(--mg-gold)' },
  APROVADO:  { label: 'Justificativa aprovada', color: 'var(--mg-green)' },
  REPROVADO: { label: 'Justificativa reprovada', color: 'var(--mg-red)' },
}

export default function AnomaliesTab({ anomalies, onExportXlsx, onOpenLog }: Props) {
  return (
    <>
      {/* Export button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={onExportXlsx}>
          ↓ XLSX
        </button>
      </div>

      {anomalies.length === 0 ? (
        <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 32, fontSize: 13 }}>
          Nenhuma anomalia detectada no período
        </div>
      ) : (
        <div>
          {anomalies.map((a, i) => {
            const dot = SEV_DOT[a.severity] ?? SEV_DOT.atencao
            return (
              <div key={`${a.log_id}-${i}`} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 0',
                borderBottom: i < anomalies.length - 1 ? 'var(--mg-border)' : 'none',
              }}>
                {/* Severity dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: dot.color,
                  boxShadow: `0 0 6px ${dot.shadow}`,
                }} />

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 7px',
                      borderRadius: 4, background: 'rgba(255,255,255,0.06)',
                      color: dot.color,
                    }}>
                      {SEV_LABEL[a.severity] ?? a.severity}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--mg-white)', fontWeight: 500 }}>
                      {a.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mg-muted)', lineHeight: 1.5 }}>
                    {a.description}
                  </div>
                  {a.justification_reason && (
                    <div style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {a.justification_status && JUST_STATUS_LABEL[a.justification_status] && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4,
                          background: 'rgba(255,255,255,0.06)',
                          color: JUST_STATUS_LABEL[a.justification_status].color,
                        }}>
                          {JUST_STATUS_LABEL[a.justification_status].label}
                        </span>
                      )}
                      <span style={{ color: 'var(--mg-muted)', fontStyle: 'italic' }}>
                        "{a.justification_reason}"
                      </span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <button
                  onClick={() => onOpenLog(a.log_id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: 'var(--mg-gold)', flexShrink: 0, marginTop: 2,
                    padding: '2px 0',
                  }}
                >
                  Ver registro →
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
