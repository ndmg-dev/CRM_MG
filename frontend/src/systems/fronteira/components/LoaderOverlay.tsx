import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { LoadingOverlay } from "@fronteira-ui";

interface LoaderApi {
  /** Mostra o overlay global que bloqueia a tela com uma mensagem. */
  show: (message?: string) => void;
  /** Esconde o overlay global. */
  hide: () => void;
  /** Roda `fn` com o overlay visível e o esconde ao terminar (mesmo em erro). */
  run: <T>(message: string, fn: () => Promise<T>) => Promise<T>;
}

const LoaderContext = createContext<LoaderApi | null>(null);

/** Loader global, equivalente ao #global-loader do Fronteira v7: um overlay
 * que cobre a página inteira enquanto um passo assíncrono roda, dizendo o que
 * está fazendo e impedindo o usuário de prosseguir com outras ações. */
export function LoaderProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  // Conta chamadas concorrentes: só esconde quando todas terminarem, pra que
  // um `hide` de uma operação não apague o overlay de outra ainda em curso.
  const pending = useRef(0);

  const show = useCallback((msg?: string) => {
    pending.current += 1;
    setMessage(msg ?? "Processando…");
  }, []);

  const hide = useCallback(() => {
    pending.current = Math.max(0, pending.current - 1);
    if (pending.current === 0) setMessage(null);
  }, []);

  const run = useCallback(
    async <T,>(msg: string, fn: () => Promise<T>): Promise<T> => {
      show(msg);
      try {
        return await fn();
      } finally {
        hide();
      }
    },
    [show, hide],
  );

  return (
    <LoaderContext.Provider value={{ show, hide, run }}>
      {children}
      <LoadingOverlay show={message !== null} message={message ?? undefined} />
    </LoaderContext.Provider>
  );
}

export function useLoader(): LoaderApi {
  const ctx = useContext(LoaderContext);
  if (!ctx) throw new Error("useLoader deve ser usado dentro de LoaderProvider");
  return ctx;
}
