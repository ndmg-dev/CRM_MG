import type { AuthResponse } from '@/types'
import { api } from '@/lib/api'
import {
  supabase,
  isSupportSupabaseConfigured,
} from '@/systems/central-suporte/integrations/supabase/client'
import {
  isFeriasSupabaseConfigured,
  supabase as feriasSupabase,
} from '@ferias/lib/supabase'
import {
  isObrigacoesSupabaseConfigured,
  supabase as obrigacoesSupabase,
} from '@obrigacoes/integrations/supabase/client'
import {
  isCopilotSupabaseConfigured,
  supabase as copilotSupabase,
} from '@copilot/lib/supabase'
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

  // Antes este bloco era um early return (`if (!isSupportSupabaseConfigured)
  // return crmSession`), o que fazia os sistemas seguintes serem pulados
  // inteiros quando a Central não estava configurada — cada satélite deve ser
  // independente dos outros, não só do CRM.
  if (isSupportSupabaseConfigured) {
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
  }

  if (isFeriasSupabaseConfigured) {
    try {
      const { error: feriasError } = await feriasSupabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleIdToken,
      })
      if (feriasError) {
        throw new Error(feriasError.message)
      }
    } catch (error) {
      // Fail-soft: falha nas Férias nunca bloqueia o login do CRM.
      console.warn('[unifiedAuth] Agendamento de Férias não autenticado (CRM segue normal):', error)
    }
  }

  // Obrigações Acessórias. Só o perímetro do ESCRITÓRIO (/app) entra por aqui:
  // o cliente do portal não tem conta Google do escritório e autentica direto
  // no Supabase do módulo, por magic link. São dois perímetros, não um filtro.
  if (isObrigacoesSupabaseConfigured) {
    try {
      const { error: obrigacoesError } = await obrigacoesSupabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleIdToken,
      })
      if (obrigacoesError) {
        throw new Error(obrigacoesError.message)
      }
    } catch (error) {
      // Fail-soft: falha em Obrigações nunca bloqueia o login do CRM.
      console.warn('[unifiedAuth] Obrigações Acessórias não autenticado (CRM segue normal):', error)
    }
  }

  // Copilot Contábil. Mesmo esquema das Férias: signInWithIdToken usando o
  // idToken do Google já validado pelo CRM, sem redirecionamento de página —
  // a conta do Supabase do Copilot precisa ter o Client ID do Google do CRM
  // liberado em Authentication > Providers > Google > Authorized Client IDs.
  if (isCopilotSupabaseConfigured) {
    try {
      const { error: copilotError } = await copilotSupabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleIdToken,
      })
      if (copilotError) {
        throw new Error(copilotError.message)
      }
    } catch (error) {
      // Fail-soft: falha no Copilot nunca bloqueia o login do CRM.
      console.warn('[unifiedAuth] Copilot Contábil não autenticado (CRM segue normal):', error)
    }
  }

  return crmSession
}

export async function endUnifiedSession(): Promise<void> {
  try {
    await Promise.allSettled([
      isSupportSupabaseConfigured
        ? supabase.auth.signOut({ scope: 'local' })
        : Promise.resolve(),
      isFeriasSupabaseConfigured
        ? feriasSupabase.auth.signOut({ scope: 'local' })
        : Promise.resolve(),
      isObrigacoesSupabaseConfigured
        ? obrigacoesSupabase.auth.signOut({ scope: 'local' })
        : Promise.resolve(),
      isCopilotSupabaseConfigured
        ? copilotSupabase.auth.signOut({ scope: 'local' })
        : Promise.resolve(),
    ])
  } finally {
    useAuthStore.getState().logout()
  }
}
