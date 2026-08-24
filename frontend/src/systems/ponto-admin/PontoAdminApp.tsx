import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Topbar } from './components/Topbar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Reports from './pages/Reports'
import Ferias from './pages/Ferias'
import Settings from './pages/Settings'
import Justifications from './pages/Justifications'
import AuditLog from './pages/AuditLog'
import Corrections from './pages/Corrections'
import Users from './pages/Users'
import Calendar from './pages/Calendar'
import Register from './pages/Register'
import BiometricCapture from './pages/BiometricCapture'
import { api } from './lib/api'
import { useAuth, type Permission } from './hooks/useAuth'
import { CronosSplash } from './components/CronosSplash'

import './styles/globals.css'
import './styles/components.css'
import './styles/dashboard.css'
// dashboard-dark.css NÃO é importado de propósito: o skin âmbar alternativo
// do Dashboard original é ligado trocando data-theme no <html> global — o
// mesmo atributo que o tema (claro/escuro) do CRM usa. Deixar isso ativo
// aqui trocaria o tema do CRM inteiro sem querer. O Dashboard fica só no
// visual padrão (já escuro) de dashboard.css.
import './styles/cronos-loader.css'

// relative="path" faz o alvo resolver como uma URL relativa normal — ver o
// comentário em components/Topbar.tsx.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('mg_token')
  if (!token) return <Navigate to="login" relative="path" replace />
  return <>{children}</>
}

function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { can } = useAuth()
  if (!can(permission)) return <Navigate to="." relative="path" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="." relative="path" replace />
  return <>{children}</>
}

interface Company {
  id: string
  name: string
  email: string
}

function Layout({ children }: { children: React.ReactNode }) {
  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ['ponto-admin-me'],
    queryFn: () => api.get('/api/v1/auth/me'),
    retry: false,
    staleTime: Infinity,
  })

  // Splash com o loader da ampulheta enquanto a 1ª carga de /me resolve.
  if (isLoading) return <CronosSplash />

  return (
    <>
      <Topbar />
      <div className="main-content">{children}</div>
    </>
  )
}

export default function PontoAdminApp() {
  return (
    <div className="pontoadmin-root">
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="cadastro/:token" element={<Register />} />
        <Route path="biometria/:token" element={<BiometricCapture />} />

        <Route index element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
        <Route path="employees" element={<RequireAuth><RequirePermission permission="employees"><Layout><Employees /></Layout></RequirePermission></RequireAuth>} />
        <Route path="reports" element={<RequireAuth><RequirePermission permission="reports"><Layout><Reports /></Layout></RequirePermission></RequireAuth>} />
        <Route path="ferias" element={<RequireAuth><RequirePermission permission="reports"><Layout><Ferias /></Layout></RequirePermission></RequireAuth>} />
        <Route path="settings" element={<RequireAuth><RequirePermission permission="settings"><Layout><Settings /></Layout></RequirePermission></RequireAuth>} />
        <Route path="justifications" element={<RequireAuth><RequirePermission permission="justifications"><Layout><Justifications /></Layout></RequirePermission></RequireAuth>} />
        <Route path="corrections" element={<RequireAuth><RequirePermission permission="corrections"><Layout><Corrections /></Layout></RequirePermission></RequireAuth>} />
        <Route path="audit" element={<RequireAuth><RequirePermission permission="audit"><Layout><AuditLog /></Layout></RequirePermission></RequireAuth>} />
        <Route path="calendar" element={<RequireAuth><RequirePermission permission="calendar"><Layout><Calendar /></Layout></RequirePermission></RequireAuth>} />
        <Route path="users" element={<RequireAuth><RequireAdmin><Layout><Users /></Layout></RequireAdmin></RequireAuth>} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </div>
  )
}
