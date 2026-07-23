import type { AuthResponse } from '@/types'
import { api } from '@/lib/api'
import {
  supabase,
  isSupportSupabaseConfigured,
} from '@/systems/central-suporte/integrations/supabase/client'
import { useAuthStore } from '@/stores/authStore'

/**
 * Sessão unificada (SSO): um único login Google autentica o CRM (JWT próprio)
 * e a Central de Suporte (Supabase via signInWithIdToken). O logout encerra
 * as duas sessões juntas.
 *
 * REGRA: o login do CRM NUNCA depende da Central. Qualquer falha na parte do
 * Supabase (env ausente, serviço fora, client ID não autorizado, RPC ausente)
 * é engolida aqui — o usuário entra no CRM normalmente e o SupportSessionGate
 * da Central explica a indisponibilidade quando ela for aberta.
 */
export async function establishUnifiedSession(googleIdToken: string): Promise<AuthResponse> {
  // O CRM valida domínio, atividade e autorização antes de provisionar qualquer
  // identidade na Central. O token retornado fica apenas em memória até o fim.
  const crmSession = await api.auth.loginWithGoogle(googleIdToken)

  if (!isSupportSupabaseConfigured) {
    return crmSession
  }

  try {
    const { error: supabaseError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: googleIdToken,
    })
    if (supabaseError) {
      throw new Error(supabaseError.message)
    }

    const { error: provisioningError } = await supabase.rpc('ensure_support_user_profile')
    if (provisioningError) {
      // Sessão criada mas sem perfil provisionado: desfaz só a parte da Central.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      throw new Error(provisioningError.message)
    }
  } catch (error) {
    // Fail-soft: registra para diagnóstico e segue com o CRM logado.
    console.warn('[unifiedAuth] Central de Suporte não autenticada (CRM segue normal):', error)
  }

  return crmSession
}

export async function endUnifiedSession(): Promise<void> {
  try {
    if (isSupportSupabaseConfigured) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    }
  } finally {
    useAuthStore.getState().logout()
  }
}
