import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button, Modal } from "@fronteira-ui";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    const normalized = typeof options === "string" ? { message: options } : options;
    setRequest(normalized);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function respond(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Modal
          open
          onOpenChange={(open) => !open && respond(false)}
          title={request.title ?? "Confirmar"}
          description={request.message}
          actions={
            <>
              <Button variant="ghost" onClick={() => respond(false)}>
                {request.cancelLabel ?? "Cancelar"}
              </Button>
              <Button variant={request.danger ? "danger" : "primary"} onClick={() => respond(true)} autoFocus>
                {request.confirmLabel ?? "Confirmar"}
              </Button>
            </>
          }
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm deve ser usado dentro de ConfirmProvider");
  return ctx;
}
