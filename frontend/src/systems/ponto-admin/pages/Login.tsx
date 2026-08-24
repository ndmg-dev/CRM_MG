import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (localStorage.getItem('mg_token')) {
    // "." (não "..") porque relative="path" trata "login" (sem barra final)
    // como um arquivo — "." já resolve pro diretório que o contém, que é a
    // base do sistema (a rota índice). Ver comentário em components/Topbar.tsx.
    return <Navigate to="." relative="path" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.post<{ access_token: string; company_name: string }>(
        '/api/v1/auth/login',
        { email, password }
      )
      localStorage.setItem('mg_token', data.access_token)
      navigate('.', { replace: true, relative: 'path' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--mg-bg)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        padding: '40px 32px',
        background: 'var(--mg-bg3)',
        border: 'var(--mg-border)',
        borderRadius: 'var(--radius-xl)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.16em',
            color: 'var(--mg-gold)',
            textTransform: 'uppercase',
          }}>
            Mendonça Galvão
          </div>
          <div style={{ fontSize: 10, color: 'var(--mg-muted)', marginTop: 3 }}>
            Contadores Associados
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, marginTop: 24, color: 'var(--mg-white)' }}>
            Acesso ao painel
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@pontomg.local"
              required
              autoFocus
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              fontSize: 13,
              color: 'var(--mg-red)',
              background: 'var(--mg-red-dim)',
              border: '0.5px solid var(--mg-red-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '11px', marginTop: 4, fontSize: 14 }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
