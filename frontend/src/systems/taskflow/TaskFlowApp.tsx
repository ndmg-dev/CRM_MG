import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DepartmentProvider } from './contexts/DepartmentContext'
import { Topbar } from './components/Topbar'
import KanbanBoard from './components/Kanban/KanbanBoard'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'

import './styles/global.css'

// Só usuários com role 'admin' (carregado via AuthContext.session.dbUser)
// acessam a rota /admin — replica a checagem de acesso do Sidebar original
// (frontend/src/components/Layout/Sidebar.jsx do repo TASK_MANANGER), que
// só exibia o link "Painel Admin" pra esse papel. Aqui também bloqueamos a
// rota em si, não só o link do menu.
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const toAbs = useNativeSystemPath()

  if (loading) return null
  if (session?.dbUser?.role !== 'admin') {
    return <Navigate to={toAbs('.')} replace />
  }
  return <>{children}</>
}

function TaskFlowRoutes() {
  return (
    <>
      <Topbar />
      <main style={{ height: 'calc(100% - 0px)', flex: 1, overflow: 'auto', position: 'relative' }}>
        <Routes>
          <Route index element={<KanbanBoard />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </main>
    </>
  )
}

// Sistema nativo migrado do iframe de https://taskflow.nucleodigital.cloud/
// (repo TASK_MANANGER, "NDMG Task Manager"). Auth SSO via Supabase próprio
// (signInWithIdToken, ver src/lib/unifiedAuth.ts) — o CRM já garante que o
// usuário está logado antes de montar este componente, então não há tela
// de login nem PrivateRoute/PublicRoute aqui (ver LoginPage.jsx do repo
// original, que não foi portada). Sidebar fixa original virou Topbar
// portalizado (ver components/Topbar.tsx); rotas planas sob
// useNativeSystemBase (Kanban=index, Dashboard, Admin).
export default function TaskFlowApp() {
  return (
    <div className="taskflow-root" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AuthProvider>
        <DepartmentProvider>
          <TaskFlowRoutes />
        </DepartmentProvider>
      </AuthProvider>
    </div>
  )
}
