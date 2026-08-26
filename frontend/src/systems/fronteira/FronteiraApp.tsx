import { Routes, Route, Navigate } from "react-router-dom";
import { TooltipProvider } from "@fronteira-ui";
import "./packages/@mg-tokens/tokens.css";
import "./index.css";
import { useNativeSystemBase, useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { LoaderProvider } from "./components/LoaderOverlay";
import Login from "./pages/Login";
import TrocarSenhaPrimeiroAcesso from "./pages/TrocarSenhaPrimeiroAcesso";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import EmpresaForm from "./pages/EmpresaForm";
import NcmRules from "./pages/NcmRules";
import NcmRuleForm from "./pages/NcmRuleForm";
import CalculoFronteira from "./pages/CalculoFronteira";
import WizardFronteira from "./pages/WizardFronteira";
import Importacao from "./pages/Importacao";
import Historico from "./pages/Historico";
import HistoricoDetalhe from "./pages/HistoricoDetalhe";
import IbsCbs from "./pages/IbsCbs";
import AntecipacaoMemoria from "./pages/AntecipacaoMemoria";
import AntecipacaoMemoriaForm from "./pages/AntecipacaoMemoriaForm";
import AntecipacaoMemoriaImportar from "./pages/AntecipacaoMemoriaImportar";
import AntecipacaoProcessar from "./pages/AntecipacaoProcessar";
import AntecipacaoHistorico from "./pages/AntecipacaoHistorico";
import AntecipacaoExcecoes from "./pages/AntecipacaoExcecoes";
import AntecipacaoExcecaoForm from "./pages/AntecipacaoExcecaoForm";
import AntecipacaoTributacoes from "./pages/AntecipacaoTributacoes";
import AntecipacaoTributacaoForm from "./pages/AntecipacaoTributacaoForm";
import Usuarios from "./pages/Usuarios";
import Configuracoes from "./pages/Configuracoes";
import UsuarioForm from "./pages/UsuarioForm";
import Excecoes from "./pages/Excecoes";
import ExcecaoForm from "./pages/ExcecaoForm";
import Comparacoes from "./pages/Comparacoes";
import ComparacaoCriar from "./pages/ComparacaoCriar";
import ComparacaoDetalhe from "./pages/ComparacaoDetalhe";

// ============================================================================
// PORT ADAPTADO de tnunes8/sistema-fronteira-v8 (frontend/src/App.tsx).
// O ORIGINAL nunca é alterado. Únicas mudanças aqui:
//   1. Sem <BrowserRouter> — o CRM já fornece um Router por fora (ver
//      src/components/systems/SystemViewer.tsx); aninhar outro quebraria a
//      navegação de todo o resto do CRM.
//   2. Todo path que era absoluto ("/", "/login", "/empresas", ...) virou
//      relativo à base deste sistema, e todo <Navigate to="/x"> virou
//      useNativeSystemPath()("x") — ver comentário em
//      @/hooks/useNativeSystemBase.ts: react-router-dom aqui NÃO resolve
//      navegação relativa como um <a href> faria, então a única forma
//      segura é resolver pra caminho absoluto manualmente.
// Estrutura de rotas, ordem, guards (Protected/AdminProtected) e todo o
// resto são idênticos ao original.
// ============================================================================

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const toAbs = useNativeSystemPath();
  if (loading) return <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>Carregando…</div>;
  if (!user) return <Navigate to={toAbs("login")} replace />;
  if (user.deve_trocar_senha) return <TrocarSenhaPrimeiroAcesso />;
  return <AppShell>{children}</AppShell>;
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const base = useNativeSystemBase();
  const toAbs = useNativeSystemPath();
  if (loading) return <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>Carregando…</div>;
  if (!user) return <Navigate to={toAbs("login")} replace />;
  if (user.deve_trocar_senha) return <TrocarSenhaPrimeiroAcesso />;
  if (!isAdmin) return <Navigate to={base} replace />;
  return <AppShell>{children}</AppShell>;
}

function NotFoundRedirect() {
  const base = useNativeSystemBase();
  return <Navigate to={base} replace />;
}

export default function FronteiraApp() {
  return (
    <div className="fronteira-root">
      <TooltipProvider>
        <AuthProvider>
          <LoaderProvider>
            <ConfirmProvider>
              <Routes>
                <Route path="login" element={<Login />} />
                <Route index element={<Protected><Dashboard /></Protected>} />
                <Route path="empresas" element={<Protected><Empresas /></Protected>} />
                <Route path="empresas/nova" element={<Protected><EmpresaForm /></Protected>} />
                <Route path="empresas/:id/editar" element={<Protected><EmpresaForm /></Protected>} />
                <Route path="ncm-rules" element={<Protected><NcmRules /></Protected>} />
                <Route path="ncm-rules/nova" element={<Protected><NcmRuleForm /></Protected>} />
                <Route path="ncm-rules/:id/editar" element={<Protected><NcmRuleForm /></Protected>} />
                <Route path="excecoes" element={<Protected><Excecoes /></Protected>} />
                <Route path="excecoes/nova" element={<Protected><ExcecaoForm /></Protected>} />
                <Route path="excecoes/:id/editar" element={<Protected><ExcecaoForm /></Protected>} />
                <Route path="comparacao" element={<Protected><Comparacoes /></Protected>} />
                <Route path="comparacao/nova" element={<Protected><ComparacaoCriar /></Protected>} />
                <Route path="comparacao/:id" element={<Protected><ComparacaoDetalhe /></Protected>} />
                <Route path="calculo" element={<Protected><CalculoFronteira /></Protected>} />
                <Route path="fronteira" element={<Protected><WizardFronteira /></Protected>} />
                <Route path="fronteira/importar" element={<Protected><Importacao /></Protected>} />
                <Route path="fronteira/historico" element={<Protected><Historico /></Protected>} />
                <Route path="fronteira/historico/:companyId/:competencia" element={<Protected><HistoricoDetalhe /></Protected>} />
                <Route path="utilitarios/ibs-cbs" element={<Protected><IbsCbs /></Protected>} />
                <Route path="antecipacao" element={<Protected><AntecipacaoMemoria /></Protected>} />
                <Route path="antecipacao/nova" element={<Protected><AntecipacaoMemoriaForm /></Protected>} />
                <Route path="antecipacao/importar" element={<Protected><AntecipacaoMemoriaImportar /></Protected>} />
                <Route path="antecipacao/:id/editar" element={<Protected><AntecipacaoMemoriaForm /></Protected>} />
                <Route path="antecipacao/processar" element={<Protected><AntecipacaoProcessar /></Protected>} />
                <Route path="antecipacao/processar/:companyId/:competencia" element={<Protected><AntecipacaoProcessar /></Protected>} />
                <Route path="antecipacao/historico" element={<Protected><AntecipacaoHistorico /></Protected>} />
                <Route path="antecipacao/excecoes" element={<Protected><AntecipacaoExcecoes /></Protected>} />
                <Route path="antecipacao/excecoes/nova" element={<Protected><AntecipacaoExcecaoForm /></Protected>} />
                <Route path="antecipacao/excecoes/:id/editar" element={<Protected><AntecipacaoExcecaoForm /></Protected>} />
                <Route path="antecipacao/tributacoes" element={<Protected><AntecipacaoTributacoes /></Protected>} />
                <Route path="antecipacao/tributacoes/nova" element={<Protected><AntecipacaoTributacaoForm /></Protected>} />
                <Route path="antecipacao/tributacoes/:id/editar" element={<Protected><AntecipacaoTributacaoForm /></Protected>} />
                <Route path="usuarios" element={<AdminProtected><Usuarios /></AdminProtected>} />
                <Route path="usuarios/novo" element={<AdminProtected><UsuarioForm /></AdminProtected>} />
                <Route path="usuarios/:id/editar" element={<AdminProtected><UsuarioForm /></AdminProtected>} />
                <Route path="configuracoes" element={<AdminProtected><Configuracoes /></AdminProtected>} />
                <Route path="*" element={<NotFoundRedirect />} />
              </Routes>
            </ConfirmProvider>
          </LoaderProvider>
        </AuthProvider>
      </TooltipProvider>
    </div>
  );
}
