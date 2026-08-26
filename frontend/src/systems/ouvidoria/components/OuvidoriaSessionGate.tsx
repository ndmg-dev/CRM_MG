import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import { supabase, isOuvidoriaSupabaseConfigured } from '../lib/supabase'
import { endUnifiedSession } from '@/lib/unifiedAuth'

// Mesmo template do SupportSessionGate da Central de Suporte
// (frontend/src/systems/central-suporte/components/auth/SupportSessionGate.tsx),
// adaptado pro Supabase/RPC da Ouvidoria. O login unificado (unifiedAuth.ts,
// bloco "Ouvidoria Corporativa") já tenta autenticar aqui via
// signInWithIdToken + ensure_ouvidoria_user_profile no momento do login do
// CRM — mas é fail-soft (nunca bloqueia o login do CRM se falhar). Então,
// quando este componente monta, a sessão Supabase da Ouvidoria PODE já
// existir (login SSO deu certo) ou não (falhou silenciosamente). Este gate
// confirma qual dos dois casos é, mostrando loading -> ready ou um erro com
// saída pra logar de novo. Envolve TODO o app, dentro de .ouvidoria-root.
export function OuvidoriaSessionGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isOuvidoriaSupabaseConfigured) {
      setMessage('A Ouvidoria Corporativa não está configurada neste ambiente (variáveis do Supabase ausentes no build).')
      setStatus('error')
      return
    }

    let active = true

    const validate = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return
      if (error) {
        setMessage('Não foi possível validar a sessão integrada da Ouvidoria. Entre novamente pelo CRM.')
        setStatus('error')
        return
      }
      if (!data.session) {
        setMessage('A sessão da Ouvidoria não foi criada ou expirou. Entre novamente pelo CRM para autenticar todos os sistemas.')
        setStatus('error')
        return
      }

      const { error: provisioningError } = await supabase.rpc('ensure_ouvidoria_user_profile')
      if (!active) return
      if (provisioningError) {
        setMessage('Não foi possível confirmar o seu cadastro na Ouvidoria Corporativa.')
        setStatus('error')
        return
      }

      setStatus('ready')
    }

    validate()
    return () => {
      active = false
    }
  }, [])

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-secondary)' }}>
        <Loader2 style={{ width: 20, height: 20, animation: 'spin 0.6s linear infinite' }} />
        Validando sessão integrada...
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <ShieldAlert style={{ width: 40, height: 40, color: 'var(--danger)' }} />
        <p style={{ maxWidth: 420, color: 'var(--text-secondary)' }}>{message}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            await endUnifiedSession()
            window.location.href = '/login'
          }}
        >
          Entrar novamente pelo CRM
        </button>
      </div>
    )
  }

  return <>{children}</>
}
