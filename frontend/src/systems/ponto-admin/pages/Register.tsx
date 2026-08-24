import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import FaceCapture from '../components/FaceCapture'
import { extractErrorDetail } from '../lib/api'

type Status = 'loading' | 'valid' | 'invalid' | 'form_submitted' | 'face_capture' | 'face_uploading' | 'success'

export default function Register() {
  const { token } = useParams<{ token: string }>()

  const [status,      setStatus]      = useState<Status>('loading')
  const [companyName, setCompanyName] = useState('')
  const [allowedDomain, setAllowedDomain] = useState<string | null>(null)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [form,        setForm]        = useState({ name: '', email: '', phone: '' })
  const [submitting,  setSubmitting]  = useState(false)
  const [formError,   setFormError]   = useState('')
  const [pendingId,   setPendingId]   = useState<string | null>(null)
  const [faceOk,         setFaceOk]         = useState<boolean | null>(null)
  const [faceError,      setFaceError]      = useState<string>('')
  const [similarEmployee, setSimilarEmployee] = useState<string | null>(null)
  const [countdown,   setCountdown]   = useState(5)

  // Contagem regressiva e redirect após sucesso
  useEffect(() => {
    if (status !== 'success') return
    setCountdown(5)
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(iv)
          window.location.href = window.location.origin
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [status])

  useEffect(() => {
    if (!token) { setErrorMsg('Link inválido.'); setStatus('invalid'); return }
    fetch(`/api/v1/registration/validate/${token}`)
      .then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ detail: 'Link inválido' }))
          setErrorMsg(extractErrorDetail(err, 'Link inválido'))
          setStatus('invalid')
          return
        }
        const data = await r.json()
        setCompanyName(data.company_name)
        setAllowedDomain(data.allowed_email_domain ?? null)
        setStatus('valid')
      })
      .catch(() => { setErrorMsg('Erro ao verificar o link. Verifique sua conexão.'); setStatus('invalid') })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) { setFormError('Informe seu nome completo.'); return }
    if (!form.email.trim() || !form.email.includes('@')) { setFormError('Informe um e-mail válido.'); return }
    if (allowedDomain && !form.email.toLowerCase().endsWith(`@${allowedDomain}`)) {
      setFormError(`Utilize apenas e-mails @${allowedDomain}.`)
      return
    }
    if (!form.phone.trim()) { setFormError('Informe seu telefone (WhatsApp).'); return }

    setSubmitting(true)
    try {
      const r = await fetch(`/api/v1/registration/submit/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: 'Erro ao enviar' }))
        setFormError(extractErrorDetail(err, 'Erro ao enviar cadastro'))
        return
      }
      const data = await r.json()
      setPendingId(data.pending_id ?? null)
      setStatus('form_submitted')
    } catch {
      setFormError('Erro de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFaceComplete(photos: string[]) {
    if (!pendingId) { setStatus('success'); return }
    setStatus('face_uploading')
    try {
      const r = await fetch(`/api/v1/registration/face/${pendingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images_base64: photos }),
      })
      if (r.ok) {
        const data = await r.json()
        setSimilarEmployee(data.similar_employee ?? null)
        setFaceOk(true)
        setStatus('success')
      } else {
        const err = await r.json().catch(() => ({ detail: 'Erro ao salvar biometria' }))
        setFaceError(extractErrorDetail(err, 'Erro ao salvar biometria. Tente novamente.'))
        setStatus('face_capture')
      }
    } catch {
      setFaceError('Erro de conexão. Verifique a rede e tente novamente.')
      setStatus('face_capture')
    }
  }

  const bg   = '#0e0f1a'
  const card = '#161829'
  const gold = '#C9960C'
  const muted = 'rgba(255,255,255,0.45)'
  const border = '1px solid rgba(255,255,255,0.08)'

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)', border,
    borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: '#fff', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, color: muted,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  return (
    <div style={{
      minHeight: '100vh', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: status === 'face_capture' ? 500 : 420 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: gold, letterSpacing: '0.04em' }}>PontoMG</div>
          {companyName && <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{companyName}</div>}
        </div>

        <div style={{ background: card, borderRadius: 14, border, padding: status === 'face_capture' ? '24px 20px' : '32px 28px' }}>

          {/* Loading */}
          {status === 'loading' && (
            <div style={{ textAlign: 'center', color: muted, padding: '24px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
              Verificando link...
            </div>
          )}

          {/* Invalid */}
          {status === 'invalid' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Link indisponível</div>
              <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>{errorMsg}</div>
            </div>
          )}

          {/* Form */}
          {status === 'valid' && (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Cadastro de funcionário</div>
              <div style={{ fontSize: 13, color: muted, marginBottom: 24, lineHeight: 1.5 }}>
                Preencha seus dados. O administrador irá confirmar seu acesso em breve.
              </div>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Nome completo *</label>
                  <input style={inputStyle} type="text" placeholder="Seu nome completo"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>E-mail *</label>
                  <input style={inputStyle} type="email" placeholder={allowedDomain ? `seu@${allowedDomain}` : 'seu@email.com'}
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  {allowedDomain && (
                    <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
                      Use um e-mail @{allowedDomain}
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>WhatsApp *</label>
                  <input style={inputStyle} type="tel" placeholder="(99) 99999-9999"
                    value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                {formError && <div style={{ fontSize: 12, color: '#E24B4A', marginBottom: 14 }}>{formError}</div>}
                <button type="submit" disabled={submitting} style={{
                  width: '100%', padding: '12px 0', background: gold, color: '#000',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                }}>
                  {submitting ? 'Enviando...' : 'Enviar cadastro'}
                </button>
              </form>
            </>
          )}

          {/* Após cadastro: oferecer biometria */}
          {status === 'form_submitted' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Cadastro enviado!</div>
              <div style={{ fontSize: 13, color: muted, marginBottom: 24, lineHeight: 1.6 }}>
                Seus dados foram recebidos. Deseja também cadastrar sua biometria facial agora?<br />
                <span style={{ fontSize: 11 }}>Isso agiliza seu acesso ao sistema de ponto quando aprovado.</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => setStatus('face_capture')} style={{
                  width: '100%', padding: '12px 0', background: gold, color: '#000',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  📷 Sim, cadastrar biometria agora
                </button>
                <button onClick={() => setStatus('success')} style={{
                  width: '100%', padding: '11px 0', background: 'transparent',
                  border, borderRadius: 8, fontSize: 13, color: muted, cursor: 'pointer',
                }}>
                  Não, pular esta etapa
                </button>
              </div>
            </div>
          )}

          {/* Captura facial */}
          {status === 'face_capture' && (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: faceError ? 10 : 16 }}>
                Cadastro de biometria facial
              </div>
              {faceError && (
                <div style={{
                  fontSize: 12, color: '#E24B4A', marginBottom: 14,
                  padding: '10px 14px', background: 'rgba(226,75,74,0.1)',
                  borderRadius: 8, border: '1px solid rgba(226,75,74,0.3)',
                }}>
                  ⚠ {faceError}
                </div>
              )}
              <FaceCapture
                onComplete={photos => { setFaceError(''); handleFaceComplete(photos) }}
                onCancel={() => setStatus('success')}
              />
            </>
          )}

          {/* Enviando biometria */}
          {status === 'face_uploading' && (
            <div style={{ textAlign: 'center', color: muted, padding: '32px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🔄</div>
              <div style={{ fontSize: 14 }}>Processando biometria...</div>
            </div>
          )}

          {/* Sucesso final */}
          {status === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {faceOk === true ? '🎉' : '✅'}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                {faceOk === true ? 'Tudo pronto!' : 'Cadastro enviado!'}
              </div>
              <div style={{ fontSize: 13, color: muted, lineHeight: 1.7 }}>
                {faceOk === true
                  ? <>Seus dados e biometria foram recebidos.<br />Aguarde a ativação pelo administrador.</>
                  : faceOk === false
                    ? <><span style={{ color: '#E24B4A' }}>⚠ Problema com a biometria</span><br />{faceError || 'O administrador poderá cadastrá-la depois.'}</>
                    : <>Seus dados foram recebidos com sucesso.<br />O administrador irá analisar e ativar seu acesso em breve.</>
                }
              </div>
              {faceOk === true && similarEmployee && (
                <div style={{
                  marginTop: 14, fontSize: 12, color: '#F59E0B', lineHeight: 1.5,
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  ⚠ Sua biometria é similar à do funcionário <strong>"{similarEmployee}"</strong> já cadastrado.
                  O administrador será notificado para verificar antes de aprovar.
                </div>
              )}
              <div style={{ marginTop: 16, fontSize: 12, color: muted }}>
                Redirecionando para o ponto em <strong style={{ color: gold }}>{countdown}s</strong>...
              </div>
            </div>
          )}

        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          PontoMG — Sistema de controle de ponto
        </div>
      </div>
    </div>
  )
}
