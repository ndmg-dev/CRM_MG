import { useState } from 'react'
import {
  useRegistrationLinks, useCreateRegistrationLink, useRevokeRegistrationLink,
  type RegistrationLink,
} from '../../hooks/useRegistration'
import { Modal } from '../Modal'

export default function GenerateLinkModal({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateRegistrationLink()
  const revokeMutation = useRevokeRegistrationLink()
  const { data: links = [] } = useRegistrationLinks()

  const [durationValue, setDurationValue] = useState('30')
  const [durationUnit,  setDurationUnit]  = useState<'minutes' | 'hours' | 'days'>('minutes')
  const [maxUses,       setMaxUses]        = useState('')
  const [createdLink,   setCreatedLink]   = useState<RegistrationLink | null>(null)
  const [copied,        setCopied]        = useState(false)
  const [err,           setErr]           = useState('')

  const unitMultiplier = { minutes: 1, hours: 60, days: 1440 }

  async function handleCreate() {
    setErr('')
    const mins = parseInt(durationValue) * unitMultiplier[durationUnit]
    if (!mins || mins < 1) { setErr('Informe uma duração válida'); return }
    const max = maxUses ? parseInt(maxUses) : null
    if (maxUses && (!max || max < 1)) { setErr('Número máximo de usos deve ser maior que 0'); return }
    try {
      const link = await createMutation.mutateAsync({ duration_minutes: mins, max_uses: max })
      setCreatedLink(link)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao gerar link') }
  }

  function copyLink() {
    if (!createdLink) return
    const url = `${window.location.origin}/cadastro/${createdLink.token}`
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const activeLinks = links.filter(l => l.is_active)

  return (
    <Modal open={true} onClose={onClose} title="Link de cadastro" maxWidth={480}>
      {!createdLink ? (
          <>
            <div style={{ fontSize: 13, color: 'var(--mg-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              Gere um link para que novos funcionários se cadastrem. O cadastro entra como pendente e precisa ser aprovado por você.
            </div>

            <div className="form-group">
              <label className="form-label">Validade do link</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" type="number" min="1" value={durationValue} style={{ maxWidth: 100 }}
                  onChange={e => setDurationValue(e.target.value)} />
                <select className="form-input" value={durationUnit}
                  onChange={e => setDurationUnit(e.target.value as typeof durationUnit)}>
                  <option value="minutes">Minutos</option>
                  <option value="hours">Horas</option>
                  <option value="days">Dias</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Máximo de cadastros (deixe vazio para ilimitado)</label>
              <input className="form-input" type="number" min="1" value={maxUses} placeholder="Ilimitado"
                style={{ maxWidth: 140 }} onChange={e => setMaxUses(e.target.value)} />
            </div>

            {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{err}</div>}

            <div className="modal-actions">
              <button className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Gerando...' : 'Gerar link'}
              </button>
            </div>

            {activeLinks.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: 'var(--mg-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mg-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Links ativos
                </div>
                {activeLinks.map(l => (
                  <div key={l.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                    border: 'var(--mg-border)', marginBottom: 6,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--mg-muted)', fontFamily: 'monospace' }}>
                        .../{l.token.slice(-12)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 2 }}>
                        {l.used_count} uso(s){l.max_uses ? ` / ${l.max_uses}` : ''} · expira {new Date(l.expires_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <button className="btn-danger" style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => revokeMutation.mutate(l.id)}>
                      Revogar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--mg-muted)', marginBottom: 16 }}>
              Link gerado com sucesso! Compartilhe com o funcionário.
              {createdLink.max_uses ? ` Válido para ${createdLink.max_uses} cadastro(s).` : ' Sem limite de cadastros.'}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(201,150,12,0.08)', border: '0.5px solid rgba(201,150,12,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
            }}>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--mg-gold)', wordBreak: 'break-all', flex: 1 }}>
                {window.location.origin}/cadastro/{createdLink.token}
              </span>
              <button className="btn-primary" style={{ flexShrink: 0, fontSize: 12, padding: '6px 14px' }} onClick={copyLink}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginBottom: 16 }}>
              Expira em: {new Date(createdLink.expires_at).toLocaleString('pt-BR')}
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setCreatedLink(null)}>Gerar outro</button>
              <button className="btn-primary" onClick={onClose}>Fechar</button>
            </div>
          </>
      )}
    </Modal>
  )
}
