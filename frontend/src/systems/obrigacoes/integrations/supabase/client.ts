import { createClient } from '@supabase/supabase-js';

// Namespace por sistema: cada app Supabase embutido no CRM tem suas próprias
// variáveis (VITE_SUPORTE_*, VITE_FERIAS_*, VITE_OBRIGACOES_*), evitando
// colisão quando vários sistemas coexistirem no mesmo build.
const SUPABASE_URL = import.meta.env.VITE_OBRIGACOES_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_OBRIGACOES_SUPABASE_PUBLISHABLE_KEY;

/**
 * Fail-soft: se as envs não estiverem no build, o CRM continua funcionando
 * (login inclusive) e apenas o módulo de Obrigações fica indisponível. O
 * placeholder impede o createClient de lançar erro na carga do módulo.
 */
export const isObrigacoesSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

// Import the supabase client like this:
// import { supabase } from "@obrigacoes/integrations/supabase/client";

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY || 'placeholder',
  {
    auth: {
      storage: localStorage,
      storageKey: 'sb-obrigacoes-auth-token',
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
