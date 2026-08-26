import { createClient } from '@supabase/supabase-js'

// Projeto Supabase PRÓPRIO do TaskFlow (NDMG Task Manager) — independente do
// backend do CRM (que usa JWT próprio, ver src/api). Prefixado com
// TASKFLOW_ para não colidir com outras variáveis VITE_SUPABASE_* que
// outros sistemas nativos possam vir a usar. Configure em
// frontend/.env.local:
//
//   VITE_TASKFLOW_SUPABASE_URL=...
//   VITE_TASKFLOW_SUPABASE_ANON_KEY=...
const supabaseUrl = import.meta.env.VITE_TASKFLOW_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_TASKFLOW_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[taskflow] Faltam variáveis de ambiente do Supabase (.env). Verifique VITE_TASKFLOW_SUPABASE_URL e VITE_TASKFLOW_SUPABASE_ANON_KEY.'
  )
}

export const isTaskflowSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Fallback evita createClient() lançar "supabaseUrl is required" e derrubar
// a aplicação inteira quando a variável não está configurada no ambiente.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)
