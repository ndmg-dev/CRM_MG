import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_FERIAS_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_FERIAS_SUPABASE_ANON_KEY;

export const isFeriasSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "http://127.0.0.1:54321",
  supabaseAnonKey || "dev-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
