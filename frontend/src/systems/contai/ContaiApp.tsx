import { Routes, Route, Navigate } from 'react-router-dom'
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase'
import { Topbar } from './components/Topbar'
import { GlobalChatPanel } from './components/GlobalChatPanel'
import { EmpresaProvider } from './context/EmpresaContext'
import Dashboard from './pages/Dashboard'
import Conciliacao from './pages/Conciliacao'
import Documentos from './pages/Documentos'
import PlanoContas from './pages/PlanoContas'
import Regras from './pages/Regras'
import Integracoes from './pages/Integracoes'
import Configuracoes from './pages/Configuracoes'

import './styles/global.css'

function NotFoundRedirect() {
  const base = useNativeSystemBase()
  return <Navigate to={base} replace />
}

// Sistema nativo que fala com a API JSON stateless do ContAI_PRO (Flask,
// hospedada à parte — branch feat/api-json-crm-sso), reutilizando o Bearer
// token do CRM (ver api/client.ts). Segue o mesmo padrão estrutural do
// FiscalMatch (rotas planas sob useNativeSystemBase, Topbar portalizado pro
// Header do CRM — ver conciliacao-fiscal/ConciliacaoFiscalApp.tsx) — este
// sistema não tem tela de login própria.
export default function ContaiApp() {
  return (
    <div className="contai-root">
      <EmpresaProvider>
        <div className="contai-shell">
          <Topbar />
          <main className="contai-main">
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="conciliacao" element={<Conciliacao />} />
              <Route path="documentos" element={<Documentos />} />
              <Route path="plano-contas" element={<PlanoContas />} />
              <Route path="regras" element={<Regras />} />
              <Route path="integracoes" element={<Integracoes />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="*" element={<NotFoundRedirect />} />
            </Routes>
          </main>
        </div>
        <GlobalChatPanel />
      </EmpresaProvider>
    </div>
  )
}
