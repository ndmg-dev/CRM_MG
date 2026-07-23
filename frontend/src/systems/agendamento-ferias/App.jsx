import { AlertTriangle, Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Solicitacoes from "./pages/Solicitacoes";
import Calendario from "./pages/Calendario";
import Colaboradores from "./pages/Colaboradores";
import Usuarios from "./pages/GestaoUsuarios";
import Configuracoes from "./pages/Configuracoes";
import {
  FeriasRouterProvider,
  Navigate,
  Route,
  Routes,
} from "./lib/router-shim";
import { endUnifiedSession } from "@/lib/unifiedAuth";
import { getFeriasPermissions } from "./lib/permissions";

function EstruturaBase() {
  const { usuarioLogado, carregando, erroAutenticacao } = useAuth();

  if (carregando) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!usuarioLogado) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-[#0a0a0a] p-6 text-center text-white">
        <AlertTriangle className="h-10 w-10 text-gold" />
        <p className="max-w-lg text-sm text-gray-400">
          {erroAutenticacao || "A sessão integrada das Férias não está disponível."}
        </p>
        <button
          type="button"
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-bold text-black hover:bg-gold"
          onClick={async () => {
            await endUnifiedSession();
            window.location.href = "/login";
          }}
        >
          Entrar novamente pelo CRM
        </button>
      </div>
    );
  }

  const permissions = getFeriasPermissions(usuarioLogado);

  return (
    <FeriasRouterProvider>
      <div className="flex h-screen overflow-hidden bg-[#0a0a0a] font-sans">
        <Sidebar />
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/solicitacoes" element={<Solicitacoes />} />
            <Route
              path="/colaboradores"
              element={!permissions.isAnalyst ? <Colaboradores /> : <Navigate to="/" />}
            />
            <Route
              path="/usuarios"
              element={permissions.canManageUsers ? <Usuarios /> : <Navigate to="/" />}
            />
            <Route
              path="/configuracoes"
              element={permissions.canConfigure ? <Configuracoes /> : <Navigate to="/" />}
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </FeriasRouterProvider>
  );
}

export default function AgendamentoFeriasApp() {
  return (
    <AuthProvider>
      <EstruturaBase />
    </AuthProvider>
  );
}
