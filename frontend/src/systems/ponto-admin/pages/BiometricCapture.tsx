import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import FaceCapture from '../components/FaceCapture'
import { extractErrorDetail } from '../lib/api'

type Status = 'loading' | 'valid' | 'invalid' | 'capturing' | 'uploading' | 'success'

export default function BiometricCapture() {
  const { token } = useParams<{ token: string }>()
  const [status,       setStatus]       = useState<Status>('loading')
  const [employeeName, setEmployeeName] = useState('')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [faceError,    setFaceError]    = useState('')

  const gold  = '#C9960C'
  const muted = 'rgba(255,255,255,0.45)'
  const border = '1px solid rgba(255,255,255,0.08)'

  useEffect(() => {
    if (!token) { setErrorMsg('Link inválido.'); setStatus('invalid'); return }
    fetch(`/api/v1/registration/biometric/${token}`)
      .then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ detail: 'Link inválido' }))
          setErrorMsg(extractErrorDetail(err, 'Link inválido'))
          setStatus('invalid')
          return
        }
        const data = await r.json()
        setEmployeeName(data.employee_name)
        setStatus('valid')
      })
      .catch(() => { setErrorMsg('Erro ao verificar o link.'); setStatus('invalid') })
  }, [token])

  async function handleFaceComplete(photos: string[]) {
    setStatus('uploading')
    try {
      const r = await fetch(`/api/v1/registration/biometric/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images_base64: photos }),
      })
      if (r.ok) {
        setStatus('success')
      } else {
        const err = await r.json().catch(() => ({ detail: 'Erro ao salvar' }))
        setFaceError(extractErrorDetail(err, 'Erro ao salvar biometria'))
        setStatus('valid')
      }
    } catch {
      setFaceError('Erro de conexão. Tente novamente.')
      setStatus('valid')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0e0f1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: status === 'capturing' ? 500 : 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: gold, letterSpacing: '0.04em' }}>PontoMG</div>
          {employeeName && <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{employeeName}</div>}
        </div>

        <div style={{ background: '#161829', borderRadius: 14, border, padding: status === 'capturing' ? '24px 20px' : '32px 28px' }}>

          {status === 'loading' && (
            <div style={{ textAlign: 'center', color: muted, padding: '24px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
              Verificando link...
            </div>
          )}

          {status === 'invalid' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Link indisponível</div>
              <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>{errorMsg}</div>
            </div>
          )}

          {status === 'valid' && (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                Cadastro de biometria facial
              </div>
              <div style={{ fontSize: 13, color: muted, marginBottom: 24, lineHeight: 1.5 }}>
                Posicione o rosto e siga as instruções para cadastrar sua biometria.
              </div>
              {faceError && (
                <div style={{ fontSize: 13, color: '#E24B4A', marginBottom: 16, padding: '10px 14px',
                  background: 'rgba(226,75,74,0.1)', borderRadius: 8, border: '1px solid rgba(226,75,74,0.3)' }}>
                  ⚠ {faceError}
                </div>
              )}
              <button
                onClick={() => setStatus('capturing')}
                style={{
                  width: '100%', padding: '13px 0', background: gold, color: '#000',
                  border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                📷 Iniciar captura facial
              </button>
            </>
          )}

          {status === 'capturing' && (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 16 }}>
                Siga as instruções de posicionamento
              </div>
              <FaceCapture
                onComplete={handleFaceComplete}
                onCancel={() => setStatus('valid')}
              />
            </>
          )}

          {status === 'uploading' && (
            <div style={{ textAlign: 'center', color: muted, padding: '32px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🔄</div>
              <div style={{ fontSize: 14 }}>Processando biometria...</div>
            </div>
          )}

          {status === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                Biometria cadastrada!
              </div>
              <div style={{ fontSize: 13, color: muted, lineHeight: 1.7 }}>
                Seu reconhecimento facial foi registrado com sucesso.<br />
                Agora você pode usar o kiosk de ponto normalmente.
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
