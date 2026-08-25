import { createClient } from '@supabase/supabase-js'

// Projeto Supabase PRÓPRIO do BIMG (Business Intelligence / Dashboard DRE) —
// independente do backend do CRM (que usa JWT próprio, ver src/api).
// Prefixado com BIMG_ para não colidir com outras variáveis VITE_SUPABASE_*
// que outros sistemas nativos possam vir a usar. Configure em
// frontend/.env.local:
//
//   VITE_BIMG_SUPABASE_URL=...
//   VITE_BIMG_SUPABASE_ANON_KEY=...
const supabaseUrl = import.meta.env.VITE_BIMG_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_BIMG_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[bimg] Faltam variáveis de ambiente do Supabase (.env). Verifique VITE_BIMG_SUPABASE_URL e VITE_BIMG_SUPABASE_ANON_KEY.'
  )
}

export const isBimgSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Fallback evita createClient() lançar "supabaseUrl is required" e derrubar
// a aplicação inteira quando a variável não está configurada no ambiente.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)
