import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { AuthGuard } from '@/components/auth/AuthGuard'
import LoginPage from '@/components/auth/LoginPage'
import MainLayout from '@/components/layout/MainLayout'

// Lazy loaded pages
import { lazy, Suspense } from 'react'
import LoadingSpinner from '@/components/common/LoadingSpinner'

const DashboardPage = lazy(() => import('@/components/dashboard/DashboardPage'))
const SystemsHub = lazy(() => import('@/components/systems/SystemsHub'))
const SystemViewer = lazy(() => import('@/components/systems/SystemViewer'))
const ClientList = lazy(() => import('@/components/clients/ClientList'))
const ClientDetail = lazy(() => import('@/components/clients/ClientDetail'))
const ClientForm = lazy(() => import('@/components/clients/ClientForm'))
const KanbanBoard = lazy(() => import('@/components/tasks/KanbanBoard'))
const AdminPage = lazy(() => import('@/components/admin/AdminPage'))
const AuditPage = lazy(() => import('@/components/audit/AuditPage'))
const PortalCliente = lazy(() => import('@/pages/PortalCliente'))
// Portal de Obrigações Acessórias: perímetro do CLIENTE, com sessão própria
// (Supabase do módulo, magic link). Fica FORA do AuthGuard de propósito — o
// cliente não tem conta Google do escritório.
const PortalObrigacoes = lazy(() => import('@obrigacoes/portal/PortalApp'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

import { GoogleOAuthProvider } from '@react-oauth/google'

export default function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={clientId}>
        <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route 
              path="/portal/:token" 
              element={
                <Suspense fallback={<LoadingSpinner label="Carregando portal..." />}>
                  <PortalCliente />
                </Suspense>
              } 
            />

            <Route
              path="/obrigacoes/portal/*"
              element={
                <Suspense fallback={<LoadingSpinner label="Carregando portal..." />}>
                  <PortalObrigacoes />
                </Suspense>
              }
            />

            <Route element={<AuthGuard />}>
              <Route element={<MainLayout />}>
                <Route
                  path="/"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/sistemas"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                      <SystemsHub />
                    </Suspense>
                  }
                />
                <Route
                  path="/sistemas/:id/*"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                      <SystemViewer />
                    </Suspense>
                  }
                />
                <Route
                  path="/clientes"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                      <ClientList />
                    </Suspense>
                  }
                />
                <Route
                  path="/clientes/novo"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                      <ClientForm />
                    </Suspense>
                  }
                />
                <Route
                  path="/clientes/:id"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                      <ClientDetail />
                    </Suspense>
                  }
                />
                <Route
                  path="/clientes/:id/editar"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                      <ClientForm />
                    </Suspense>
                  }
                />
                <Route
                  path="/tarefas"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                      <KanbanBoard />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                      <AdminPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/auditoria"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                      <AuditPage />
                    </Suspense>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1a1a1a',
              color: '#f5f5f5',
              border: '1px solid #2a2a2a',
            },
            success: { iconTheme: { primary: '#d4a843', secondary: '#1a1a1a' } },
          }}
        />
      </QueryClientProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  )
}
