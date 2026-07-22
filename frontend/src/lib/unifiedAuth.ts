import type { AuthResponse } from '@/types'
import { api } from '@/lib/api'
import { supabase } from '@/systems/central-suporte/integrations/supabase/client'
import { useAuthStore } from '@/stores/authStore'

/**
 * Sessão unificada (SSO): um único login Google autentica o CRM (JWT próprio)
 * e a Central de Suporte (Supabase via signInWithIdToken). O logout encerra
 * as duas sessões juntas.
 */
export async function establishUnifiedSession(googleIdToken: string): Promise<AuthResponse> {
  // O CRM valida domínio, atividade e autorização antes de provisionar qualquer
  // identidade na Central. O token retornado fica apenas em memória até o fim.
  const crmSession = await api.auth.loginWithGoogle(googleIdToken)

  const { error: supabaseError } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: googleIdToken,
  })
  if (supabaseError) {
    throw new Error(`Não foi possível autenticar a Central de Suporte: ${supabaseError.message}`)
  }

  try {
    const { error: provisioningError } = await supabase.rpc('ensure_support_user_profile')
    if (provisioningError) {
      throw new Error(`Não foi possível registrar o usuário nos sistemas: ${provisioningError.message}`)
    }

    return crmSession
  } catch (error) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    throw error
  }
}

export async function endUnifiedSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  } finally {
    useAuthStore.getState().logout()
  }
}
