import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Topbar } from './components/Topbar'
// Lazy por página — este era o 2º maior chunk de todo o build (1.2MB
// minificado só ele) porque as 13 páginas do Ponto Admin (Dashboard,
// Reports, Calendar etc., cada uma com seus próprios gráficos/tabelas)
// entravam juntas num chunk só. Cada rota agora carrega por conta própria,
// só quando a pessoa navega até ela — reduz o pico de memória do build e
// o tanto de JS baixado de cara pra quem só usa uma parte do sistema.
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Employees = lazy(() => import('./pages/Employees'))
const Reports = lazy(() => import('./pages/Reports'))
const Ferias = lazy(() => import('./pages/Ferias'))
const Settings = lazy(() => import('./pages/Settings'))
const Justifications = lazy(() => import('./pages/Justifications'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const Corrections = lazy(() => import('./pages/Corrections'))
const Users = lazy(() => import('./pages/Users'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Register = lazy(() => import('./pages/Register'))
const BiometricCapture = lazy(() => import('./pages/BiometricCapture'))
import { api } from './lib/api'
import { useAuth, type Permission } from './hooks/useAuth'
import { usePontoBase, usePontoPath } from './hooks/usePontoBase'
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

// Ver comentário em hooks/usePontoBase.ts: navegação aqui é sempre por
// caminho absoluto, nunca relativo — react-router-dom não resolve "to"
// relativo como um <a href> faria (nem com relative="path", nem ".").
function RequireAuth({ children }: { children: React.ReactNode }) {
  const toAbs = usePontoPath()
  const token = localStorage.getItem('mg_token')
  if (!token) return <Navigate to={toAbs('login')} replace />
  return <>{children}</>
}

function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const base = usePontoBase()
  const { can } = useAuth()
  if (!can(permission)) return <Navigate to={base} replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const base = usePontoBase()
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to={base} replace />
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

function NotFoundRedirect() {
  const base = usePontoBase()
  return <Navigate to={base} replace />
}

// Espelho de ponto virou uma aba dentro de Relatórios (ver Reports.tsx,
// innerTab === 'espelho') — consolida com o componente MirrorTab.tsx do
// satélite, que já embute homologação de mês, em vez de uma página própria.
// Redireciona quem tinha a rota antiga salva.
function EspelhoRedirect() {
  const toAbs = usePontoPath()
  return <Navigate to={toAbs('reports')} replace />
}

export default function PontoAdminApp() {
  return (
    <div className="pontoadmin-root">
      <Suspense fallback={null}>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="cadastro/:token" element={<Register />} />
          <Route path="biometria/:token" element={<BiometricCapture />} />

          <Route index element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
          <Route path="employees" element={<RequireAuth><RequirePermission permission="employees"><Layout><Employees /></Layout></RequirePermission></RequireAuth>} />
          <Route path="reports" element={<RequireAuth><RequirePermission permission="reports"><Layout><Reports /></Layout></RequirePermission></RequireAuth>} />
          <Route path="espelho" element={<EspelhoRedirect />} />
          <Route path="ferias" element={<RequireAuth><RequirePermission permission="reports"><Layout><Ferias /></Layout></RequirePermission></RequireAuth>} />
          <Route path="settings" element={<RequireAuth><RequirePermission permission="settings"><Layout><Settings /></Layout></RequirePermission></RequireAuth>} />
          <Route path="justifications" element={<RequireAuth><RequirePermission permission="justifications"><Layout><Justifications /></Layout></RequirePermission></RequireAuth>} />
          <Route path="corrections" element={<RequireAuth><RequirePermission permission="corrections"><Layout><Corrections /></Layout></RequirePermission></RequireAuth>} />
          <Route path="audit" element={<RequireAuth><RequirePermission permission="audit"><Layout><AuditLog /></Layout></RequirePermission></RequireAuth>} />
          <Route path="calendar" element={<RequireAuth><RequirePermission permission="calendar"><Layout><Calendar /></Layout></RequirePermission></RequireAuth>} />
          <Route path="users" element={<RequireAuth><RequireAdmin><Layout><Users /></Layout></RequireAdmin></RequireAuth>} />
          <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      </Suspense>
    </div>
  )
}
