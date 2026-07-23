declare module '@ferias/App' {
  import type { ComponentType } from 'react'

  const AgendamentoFeriasApp: ComponentType
  export default AgendamentoFeriasApp
}

declare module '@ferias/lib/supabase' {
  import type { SupabaseClient } from '@supabase/supabase-js'

  export const isFeriasSupabaseConfigured: boolean
  export const supabase: SupabaseClient
}
