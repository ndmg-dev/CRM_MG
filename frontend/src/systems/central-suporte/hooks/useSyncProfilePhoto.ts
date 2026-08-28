import { useEffect } from "react";
import { supabase } from "@suporte/integrations/supabase/client";

/**
 * Grava a foto do Google (vinda de user_metadata da própria sessão de
 * login) na linha do usuário em `profiles`, toda vez que a Central de
 * Suporte é aberta. Sem isso, ninguém vê a foto de ninguém — só iniciais —
 * porque o `profiles` daqui é um banco separado do CRM principal e nunca
 * teve de onde puxar a foto.
 *
 * É sempre uma escrita na PRÓPRIA linha (auth.uid() = id), então passa pela
 * RLS de UPDATE que já existe em `profiles` sem precisar de policy nova.
 * Não precisa de webhook/cron pra manter atualizado: se a pessoa trocar a
 * foto no Google, o próximo login já resincroniza sozinho.
 */
export function useSyncProfilePhoto() {
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      const fotoUrl = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined;
      if (!fotoUrl) return;
      supabase
        .from("profiles")
        .update({ foto_url: fotoUrl })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) console.error("[perfil] Falha ao sincronizar foto de perfil:", error);
        });
    });
    return () => { cancelled = true; };
  }, []);
}
