import { createClient } from '@supabase/supabase-js'

// Projeto Supabase PRÓPRIO do Copilot Contábil — independente do backend do
// CRM (que usa JWT próprio, ver src/api). Prefixado com COPILOT_ para não
// colidir com outras variáveis VITE_SUPABASE_* que outros sistemas nativos
// possam vir a usar. Configure em frontend/.env.local:
//
//   VITE_COPILOT_SUPABASE_URL=...
//   VITE_COPILOT_SUPABASE_ANON_KEY=...
const supabaseUrl = import.meta.env.VITE_COPILOT_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_COPILOT_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[copilot-contabil] Faltam variáveis de ambiente do Supabase (.env). Verifique VITE_COPILOT_SUPABASE_URL e VITE_COPILOT_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
