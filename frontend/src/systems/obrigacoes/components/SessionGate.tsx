import type { ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { isObrigacoesSupabaseConfigured } from '../integrations/supabase/client'
import { useSessao } from '../hooks/useObrigacoes'

/**
 * Explica a indisponibilidade em vez de mostrar tela vazia.
 *
 * O SSO do CRM é fail-soft de propósito (uma falha aqui não pode derrubar o
 * login do CRM inteiro), então este módulo tem de ser capaz de dizer por que
 * não abriu. Os dois motivos reais:
 *
 *  1. envs VITE_OBRIGACOES_* ausentes no build;
 *  2. sessão sem claims — o custom access token hook não está registrado no
 *     projeto Supabase, ou o usuário não está provisionado. Sem claims o RLS
 *     nega tudo e a tela apareceria vazia sem explicação.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { data: sessao, isLoading, isError } = useSessao()

  if (!isObrigacoesSupabaseConfigured) {
    return (
      <Aviso titulo="Módulo não configurado">
        As variáveis <code className="font-mono">VITE_OBRIGACOES_SUPABASE_URL</code> e{' '}
        <code className="font-mono">VITE_OBRIGACOES_SUPABASE_PUBLISHABLE_KEY</code> não estão
        presentes neste build.
      </Aviso>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" aria-hidden="true" />
      </div>
    )
  }

  if (isError || !sessao) {
    return (
      <Aviso titulo="Sessão sem permissões">
        Você está autenticado, mas a sessão não trouxe tenant nem perímetro. Verifique se o
        hook <code className="font-mono">custom_access_token</code> está registrado em
        Authentication → Hooks e se o seu usuário está cadastrado no módulo.
      </Aviso>
    )
  }

  return <>{children}</>
}

function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-20 text-center">
      <AlertTriangle className="h-10 w-10 text-warning" aria-hidden="true" />
      <h2 className="text-lg text-text-primary">{titulo}</h2>
      <p className="text-sm leading-relaxed text-text-secondary">{children}</p>
    </div>
  )
}
