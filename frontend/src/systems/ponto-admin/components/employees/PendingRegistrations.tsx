import type { PendingRegistration } from '../../hooks/useRegistration'
import Avatar from '../Avatar'

interface PendingRegistrationsProps {
  pendingList: PendingRegistration[]
  onApprove: (p: PendingRegistration) => void
  onReject: (id: string) => void
}

export default function PendingRegistrations({ pendingList, onApprove, onReject }: PendingRegistrationsProps) {
  if (pendingList.length === 0) return null

  return (
    <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(201,150,12,0.3)', background: 'rgba(201,150,12,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>⏳</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mg-gold)' }}>
          Cadastros aguardando aprovação ({pendingList.length})
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pendingList.map(p => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: 'var(--mg-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={p.name} size={32} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--mg-muted)' }}>
                    {p.email}{p.phone ? ` · ${p.phone}` : ''} · enviado {new Date(p.submitted_at).toLocaleString('pt-BR')}
                  </span>
                  {p.has_face && (
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                      background: 'rgba(42,157,92,0.15)', color: 'var(--mg-green)',
                      border: '0.5px solid rgba(42,157,92,0.3)',
                    }}>
                      📷 Biometria cadastrada
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => onApprove(p)}>
                Aprovar
              </button>
              <button className="btn-danger" style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => { if (confirm(`Rejeitar cadastro de ${p.name}?`)) onReject(p.id) }}>
                Rejeitar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
