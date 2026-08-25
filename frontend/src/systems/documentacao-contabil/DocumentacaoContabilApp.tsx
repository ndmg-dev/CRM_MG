import { Navigate, Route, Routes } from 'react-router-dom'
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase'
import { Topbar } from '@doccontabil/components/Topbar'
import { ToastProvider } from '@doccontabil/components/Toast'
import { Dashboard } from '@doccontabil/pages/Dashboard'
import { Empresas } from '@doccontabil/pages/Empresas'
import { GerarNotas } from '@doccontabil/pages/GerarNotas'
import { Historico } from '@doccontabil/pages/Historico'

import '@doccontabil/styles/global.css'

function NotFoundRedirect() {
  const base = useNativeSystemBase()
  return <Navigate to={base} replace />
}

// Sistema nativo migrado do iframe de https://doccontabil.mendoncagalvao.com.br
// (repo GERADOR_DE_NOTAS) — exibido no CRM como "Documentação Contábil".
// A API própria não tem autenticação (decisão documentada no repo original;
// não reutiliza o Bearer do CRM). Rotas planas sob useNativeSystemBase,
// Topbar portalizado pro Header do CRM — mesmo padrão do ContAI/FiscalMatch
// (ver contai/ContaiApp.tsx). QueryClientProvider é o global do CRM (ver
// src/App.tsx) — não cria um provider próprio.
export default function DocumentacaoContabilApp() {
  return (
    <div className="doccontabil-root min-h-screen">
      <ToastProvider>
        <Topbar />
        <main className="mx-auto max-w-6xl px-6 py-8">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="gerar" element={<GerarNotas />} />
            <Route path="historico" element={<Historico />} />
            <Route path="empresas" element={<Empresas />} />
            <Route path="*" element={<NotFoundRedirect />} />
          </Routes>
        </main>
      </ToastProvider>
    </div>
  )
}
