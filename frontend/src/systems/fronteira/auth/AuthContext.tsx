import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";

// PORT ADAPTADO de tnunes8/sistema-fronteira-v8 (frontend/src/auth/AuthContext.tsx).
// Única mudança real: `logout()` navegava pra "/login" (raiz do site,
// fazia sentido no v8 rodando sozinho); aqui isso seria a raiz do CRM
// inteiro, então vira o login DESTE sistema dentro de /sistemas/:id — mesmo
// ajuste que lib/api.ts já faz pro 401/refresh falho. Todo o resto (fluxo
// de login/MFA/refresh) é idêntico ao original.
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: "administrador" | "coordenador" | "operador";
  is_active: boolean;
  deve_trocar_senha: boolean;
}

export interface LoginResult {
  mfaRequired: boolean;
  emailMascarado?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  verificarCodigo: (codigo: string) => Promise<void>;
  reenviarCodigo: () => Promise<string | undefined>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isCoordenador: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

function loginPathForCurrentSystem(): string {
  const match = window.location.pathname.match(/^(\/sistemas\/[^/]+)/);
  return match ? `${match[1]}/login` : "/login";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<User>("/auth/me", { _noRedirect: true })
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string): Promise<LoginResult> {
    const form = new URLSearchParams({ username, password });
    const res = await api.post<{ mfa_required?: boolean; email_mascarado?: string }>(
      "/auth/login",
      form,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    if (res.data?.mfa_required) {
      return { mfaRequired: true, emailMascarado: res.data.email_mascarado };
    }

    const me = await api.get<User>("/auth/me");
    setUser(me.data);
    return { mfaRequired: false };
  }

  async function verificarCodigo(codigo: string) {
    await api.post("/auth/login/mfa", { codigo });
    const me = await api.get<User>("/auth/me");
    setUser(me.data);
  }

  async function reenviarCodigo() {
    const res = await api.post<{ email_mascarado?: string }>("/auth/login/mfa/reenviar");
    return res.data?.email_mascarado;
  }

  async function refreshUser() {
    const me = await api.get<User>("/auth/me");
    setUser(me.data);
  }

  function logout() {
    api
      .post("/auth/logout")
      .catch(() => {})
      .finally(() => {
        setUser(null);
        const loginPath = loginPathForCurrentSystem();
        if (!location.pathname.startsWith(loginPath)) location.href = loginPath;
      });
  }

  const isCoordenador = user?.role === "coordenador" || user?.role === "administrador";
  const isAdmin = user?.role === "administrador";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        verificarCodigo,
        reenviarCodigo,
        logout,
        refreshUser,
        isCoordenador,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
