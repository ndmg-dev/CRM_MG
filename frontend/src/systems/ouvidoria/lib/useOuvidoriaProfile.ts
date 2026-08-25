import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { OuvidoriaUser } from './types'

// Perfil da linha `public.users` correspondente à sessão Supabase ativa
// (join implícito por auth_user_id = auth.uid(), igual ao helper SQL
// ouvidoria_current_user_id() da migration). Usado pelo rodapé da sidebar
// (Layout), pelo RequireAdmin e pela tela de Perfil — uma query só,
// cacheada pelo react-query, em vez de repetir o SELECT em cada tela.
export function useOuvidoriaProfile() {
  return useQuery({
    queryKey: ['ouvidoria-profile'],
    queryFn: async (): Promise<OuvidoriaUser> => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const authUserId = sessionData.session?.user.id
      if (!authUserId) throw new Error('Sem sessão ativa na Ouvidoria.')

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single()

      if (error) throw error
      return data as OuvidoriaUser
    },
    staleTime: 60_000,
    retry: false,
  })
}
