import { Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { ResetPassword } from './pages/ResetPassword'
import { Dashboard } from './pages/Dashboard'
import { Leads } from './pages/Leads'
import { Campaigns } from './pages/Campaigns'
import { CRM } from './pages/CRM'
import { Templates } from './pages/Templates'
import { Layout } from './components/Layout'
import { useNativeSystemBase, useNativeSystemPath } from '@/hooks/useNativeSystemBase'

import './styles/globals.css'

// Só as páginas internas (staff) do MG Prospect AI foram portadas — Dashboard,
// Leads (com modo Radar/mapa), Campaigns, CRM (Kanban) e Templates. As rotas
// públicas do app original, `/interesse/:token` (formulário de interesse
// preenchido por leads externos) e `/unsubscribe/:token`, continuam servidas
// pelo site original (prospect.nucleodigital.cloud) sem nenhuma mudança: não
// faz sentido colocar um formulário público atrás do login do CRM, e o
// SystemViewer sempre exige login pra qualquer sistema nativo.

const TOKEN_KEY = 'mgprospect_token'

// Ver comentário em hooks/useNativeSystemBase.ts: navegação aqui é sempre por
// caminho absoluto, nunca relativo — react-router-dom não resolve "to"
// relativo como um <a href> faria.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const toAbs = useNativeSystemPath()
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return <Navigate to={toAbs('login')} replace />
  return <>{children}</>
}

function NotFoundRedirect() {
  const base = useNativeSystemBase()
  return <Navigate to={base} replace />
}

export default function MgProspectApp() {
  return (
    <div className="mgprospect-root">
      <Routes>
        <Route path="login" element={<Login />} />
        {/* Original só alcançava esta tela checando window.location.pathname
            fora do react-router (nunca era uma <Route> de verdade); aqui vira
            rota igual às outras. Continua sem exigir sessão — o link de
            redefinição de senha chega por e-mail com ?token=&email= na query,
            antes do usuário conseguir logar. */}
        <Route path="reset-password" element={<ResetPassword />} />

        <Route index element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
        <Route path="campaigns" element={<RequireAuth><Layout><Campaigns /></Layout></RequireAuth>} />
        <Route path="leads" element={<RequireAuth><Layout><Leads /></Layout></RequireAuth>} />
        <Route path="crm" element={<RequireAuth><Layout><CRM /></Layout></RequireAuth>} />
        <Route path="templates" element={<RequireAuth><Layout><Templates /></Layout></RequireAuth>} />
        <Route path="*" element={<NotFoundRedirect />} />
      </Routes>
    </div>
  )
}
