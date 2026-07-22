import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@suporte/components/ui/button";
import { supabase } from "@suporte/integrations/supabase/client";
import { endUnifiedSession } from "@/lib/unifiedAuth";

export function SupportSessionGate({ children }: { children: ReactNode }) {
  const mockMode = import.meta.env.VITE_USE_MOCK === "true";
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    mockMode ? "ready" : "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (mockMode) {
      return;
    }

    let active = true;

    const validate = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setMessage("Não foi possível validar a sessão integrada da Central. Entre novamente pelo CRM.");
        setStatus("error");
        return;
      }
      if (!data.session) {
        setMessage("A sessão da Central não foi criada ou expirou. Entre novamente pelo CRM para autenticar todos os sistemas.");
        setStatus("error");
        return;
      }

      const { error: provisioningError } = await supabase.rpc("ensure_support_user_profile");
      if (!active) return;
      if (provisioningError) {
        setMessage("Não foi possível confirmar o cadastro do usuário na Central.");
        setStatus("error");
        return;
      }

      setStatus("ready");
    };

    validate();
    return () => { active = false; };
  }, [mockMode]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Validando sessão integrada...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="max-w-md text-muted-foreground">{message}</p>
        <Button onClick={async () => { await endUnifiedSession(); window.location.href = "/login"; }}>
          Entrar novamente pelo CRM
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
