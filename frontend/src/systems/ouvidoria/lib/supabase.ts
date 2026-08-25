import { createClient } from '@supabase/supabase-js'

// Projeto Supabase PRÓPRIO da Ouvidoria Corporativa — independente do
// backend do CRM (JWT próprio) e do Supabase da Central de Suporte/Férias/
// Obrigações/Copilot/BIMG. Prefixado com OUVIDORIA_ pra não colidir com as
// outras variáveis VITE_*_SUPABASE_*. Configure em frontend/.env.local:
//
//   VITE_OUVIDORIA_SUPABASE_URL=...
//   VITE_OUVIDORIA_SUPABASE_ANON_KEY=...
const supabaseUrl = import.meta.env.VITE_OUVIDORIA_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_OUVIDORIA_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[ouvidoria] Faltam variáveis de ambiente do Supabase (.env). Verifique VITE_OUVIDORIA_SUPABASE_URL e VITE_OUVIDORIA_SUPABASE_ANON_KEY.'
  )
}

export const isOuvidoriaSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Fallback evita createClient() lançar "supabaseUrl is required" e derrubar
// a aplicação inteira quando a variável não está configurada no ambiente.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)
