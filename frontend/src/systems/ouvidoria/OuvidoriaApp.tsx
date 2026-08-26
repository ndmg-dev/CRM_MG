import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase'
import { supabase } from './lib/supabase'
import { useOuvidoriaProfile } from './lib/useOuvidoriaProfile'
import { OuvidoriaSessionGate } from './components/OuvidoriaSessionGate'
import { Layout } from './components/Layout'

import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import ComplaintsList from './pages/ComplaintsList'
import ComplaintCreate from './pages/ComplaintCreate'
import ComplaintDetail from './pages/ComplaintDetail'
import Chat from './pages/Chat'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminComplaints from './pages/admin/AdminComplaints'
import AdminComplaintDetail from './pages/admin/AdminComplaintDetail'
import AdminKnowledge from './pages/admin/AdminKnowledge'
import AdminAudit from './pages/admin/AdminAudit'

import './styles/globals.css'

// Ver comentário em hooks/useNativeSystemBase.ts: navegação aqui é sempre
// por caminho absoluto, nunca relativo — react-router-dom não resolve "to"
// relativo como um <a href> faria (nem com relative="path", nem ".").
// Não usar <BrowserRouter> aqui: o CRM já fornece um Router por fora
// (ver src/components/systems/SystemViewer.tsx) — aninhar outro quebraria a
// navegação de todo o resto do CRM.

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-secondary)' }}>
      <Loader2 style={{ width: 20, height: 20, animation: 'spin 0.6s linear infinite' }} />
      Carregando...
    </div>
  )
}

// A sessão Supabase já foi validada pelo OuvidoriaSessionGate (que envolve
// todo o app antes de qualquer rota renderizar) — este guard é uma segunda
// camada, pro caso da sessão expirar enquanto a pessoa já está navegando
// dentro do sistema (ex: aba aberta por horas). Sem tela de login própria:
// o login é sempre pelo CRM.
function RequireAuth({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'ok'>('checking')

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (!data.session) {
        window.location.href = '/login'
        return
      }
      setStatus('ok')
    })
    return () => {
      active = false
    }
  }, [])

  if (status === 'checking') return <LoadingScreen />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const base = useNativeSystemBase()
  const { data: profile, isLoading } = useOuvidoriaProfile()

  if (isLoading) return <LoadingScreen />
  if (profile?.role !== 'admin') return <Navigate to={base} replace />
  return <>{children}</>
}

function NotFoundRedirect() {
  const base = useNativeSystemBase()
  return <Navigate to={base} replace />
}

export default function OuvidoriaApp() {
  return (
    <div className="ouvidoria-root">
      <OuvidoriaSessionGate>
        <RequireAuth>
          <Routes>
            <Route index element={<Layout><Dashboard /></Layout>} />
            <Route path="profile" element={<Layout><Profile /></Layout>} />
            <Route path="manifestacoes" element={<Layout><ComplaintsList /></Layout>} />
            <Route path="manifestacoes/nova" element={<Layout><ComplaintCreate /></Layout>} />
            <Route path="manifestacoes/:id" element={<Layout><ComplaintDetail /></Layout>} />
            <Route path="chat" element={<Layout><Chat /></Layout>} />

            <Route path="admin" element={<RequireAdmin><Layout><AdminDashboard /></Layout></RequireAdmin>} />
            <Route path="admin/manifestacoes" element={<RequireAdmin><Layout><AdminComplaints /></Layout></RequireAdmin>} />
            <Route path="admin/manifestacoes/:id" element={<RequireAdmin><Layout><AdminComplaintDetail /></Layout></RequireAdmin>} />
            <Route path="admin/conhecimento" element={<RequireAdmin><Layout><AdminKnowledge /></Layout></RequireAdmin>} />
            <Route path="admin/auditoria" element={<RequireAdmin><Layout><AdminAudit /></Layout></RequireAdmin>} />

            <Route path="*" element={<NotFoundRedirect />} />
          </Routes>
        </RequireAuth>
      </OuvidoriaSessionGate>
    </div>
  )
}
