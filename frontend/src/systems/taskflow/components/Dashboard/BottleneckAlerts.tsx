import { TriangleAlert, Clock } from 'lucide-react'

export default function BottleneckAlerts({ bottlenecks }: { bottlenecks: any }) {
  if (!bottlenecks) return null

  const { wip_violations = [], stalled_tickets = [] } = bottlenecks
  const hasAlerts = wip_violations.length > 0 || stalled_tickets.length > 0

  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Alertas de Gargalo
      </h3>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        WIP Limits e tickets parados há mais de 48h
      </p>

      {!hasAlerts ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--color-success)',
            fontSize: 13,
            background: 'var(--color-success-soft)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          ✅ Nenhum gargalo identificado. O fluxo está saudável!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {wip_violations.map((v: any, i: number) => (
            <div
              key={`wip-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'var(--color-danger-soft)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <TriangleAlert
                size={20}
                style={{ color: 'var(--color-danger)', flexShrink: 0 }}
              />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>
                  WIP Limit Excedido — {v.column}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {v.count} tickets ativos (limite: 5). Considere finalizar tickets antes de iniciar novos.
                </p>
              </div>
            </div>
          ))}

          {stalled_tickets.map((t: any, i: number) => (
            <div
              key={`stalled-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'var(--color-warning-soft)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              <Clock
                size={20}
                style={{ color: 'var(--color-warning)', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-warning)' }}>
                  {t.titulo}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Parado em <strong>{t.status}</strong> há {Math.round(t.hours_stalled / 24)} dias
                  {t.assignee && ` • Responsável: ${t.assignee}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
