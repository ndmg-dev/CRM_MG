import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import LoginPage from './components/LoginPage'
import DashboardPage from './components/DashboardPage'

import './styles/global.css'

const ALLOWED_DOMAIN = 'mendoncagalvao.com.br'

// Sistema tem auth PRÓPRIA via Supabase (projeto separado do backend do
// CRM — ver lib/supabase.ts), igual ao Copilot Contábil. No original (Next.js)
// esse controle era feito por um middleware de servidor (src/middleware.ts)
// que lia o cookie de sessão e redirecionava para /login antes de renderizar
// qualquer página. Numa SPA client-side isso não existe: o guard vira estado
// React que decide entre LoginPage e o dashboard, exatamente como
// CopilotContabilApp.jsx faz.
function AppContent() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Check current session on mount (handles SSO / OAuth redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        validateAndSetSession(session)
      }
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          validateAndSetSession(session)
        } else {
          setSession(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const validateAndSetSession = (session: any) => {
    const email = session.user?.email || ''
    if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setAuthError(null)
      setSession(session)
    } else {
      // Domínio não autorizado — mesma regra do middleware.ts original.
      setAuthError('Acesso negado. Utilize um e-mail com domínio @mendoncagalvao.com.br.')
      supabase.auth.signOut()
      setSession(null)
    }
  }

  // Show loading spinner while checking session
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#27272a] border-t-[#d4af37] rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!session) {
    return <LoginPage errorMsg={authError} />
  }

  return (
    <Routes>
      <Route path="*" element={<DashboardPage />} />
    </Routes>
  )
}

export default function BimgApp() {
  return (
    <div className="bimg-root">
      <AppContent />
    </div>
  )
}
