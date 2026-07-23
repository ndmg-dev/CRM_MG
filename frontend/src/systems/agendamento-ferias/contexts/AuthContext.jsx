import { createContext, useContext, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { isFeriasSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext({});
const ARTHUR_EMAIL = "arthur.monteiro@mendoncagalvao.com.br";

export function AuthProvider({ children }) {
  const crmUser = useAuthStore((state) => state.user);
  const mockMode = import.meta.env.VITE_USE_MOCK === "true";
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erroAutenticacao, setErroAutenticacao] = useState("");

  useEffect(() => {
    if (mockMode) {
      if (!crmUser) {
        setUsuarioLogado(null);
        setErroAutenticacao("Usuário mock do CRM não encontrado.");
      } else {
        const email = crmUser.email?.trim().toLowerCase() || "";
        const isArthurAdmin = email === ARTHUR_EMAIL;
        setUsuarioLogado({
          id: crmUser.id,
          email: crmUser.email,
          nome: crmUser.nome,
          perfil: isArthurAdmin ? "Administrador" : "Analista",
          setor: crmUser.setor,
          iniciais: crmUser.nome ? crmUser.nome.substring(0, 2).toUpperCase() : "MG",
        });
        setErroAutenticacao("");
      }
      setCarregando(false);
      return;
    }

    if (!isFeriasSupabaseConfigured) {
      setErroAutenticacao(
        "Configure VITE_FERIAS_SUPABASE_URL e VITE_FERIAS_SUPABASE_ANON_KEY para ativar o login único das Férias.",
      );
      setCarregando(false);
      return;
    }

    let active = true;

    const buscarPerfilUsuario = async (authUser) => {
      const email = authUser.email?.trim().toLowerCase() || "";
      if (!email.endsWith("@mendoncagalvao.com.br")) {
        if (active) {
          setUsuarioLogado(null);
          setErroAutenticacao("Acesso permitido somente ao domínio @mendoncagalvao.com.br.");
          setCarregando(false);
        }
        await supabase.auth.signOut({ scope: "local" });
        return;
      }

      const { data, error } = await supabase
        .from("usuarios_sistema")
        .select("*")
        .eq("email", email)
        .single();

      if (!active) return;
      if (error || !data) {
        setUsuarioLogado(null);
        setErroAutenticacao(`O e-mail ${email} não está autorizado no sistema de férias.`);
        setCarregando(false);
        return;
      }
      if (data.status === "bloqueado") {
        setUsuarioLogado(null);
        setErroAutenticacao("Seu acesso ao sistema de férias está bloqueado.");
        setCarregando(false);
        return;
      }

      setUsuarioLogado({
        id: authUser.id,
        email: authUser.email,
        nome: data.nome,
        perfil: data.perfil,
        setor: data.setor,
        iniciais: data.nome ? data.nome.substring(0, 2).toUpperCase() : "MG",
      });
      setErroAutenticacao("");
      setCarregando(false);
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return;
      if (error || !session?.user) {
        setUsuarioLogado(null);
        setErroAutenticacao("A sessão das Férias não foi criada. Entre novamente pelo CRM.");
        setCarregando(false);
        return;
      }
      void buscarPerfilUsuario(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        void buscarPerfilUsuario(session.user);
      } else {
        setUsuarioLogado(null);
        setCarregando(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [crmUser, mockMode]);

  return (
    <AuthContext.Provider value={{ usuarioLogado, carregando, erroAutenticacao }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
