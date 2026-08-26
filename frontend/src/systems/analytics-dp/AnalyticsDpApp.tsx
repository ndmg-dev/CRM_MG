import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase'
import { Topbar } from '@analyticsdp/components/Topbar'
import { LoginGate } from '@analyticsdp/components/LoginGate'
import { DashboardPage } from '@analyticsdp/pages/DashboardPage'
import { ImportsPage } from '@analyticsdp/pages/ImportsPage'
import { EmployeesPage } from '@analyticsdp/pages/EmployeesPage'
import { QualityPage } from '@analyticsdp/pages/QualityPage'
import { PersonnelCostPage } from '@analyticsdp/pages/PersonnelCostPage'

import '@analyticsdp/styles/global.css'

function NotFoundRedirect() {
  const base = useNativeSystemBase()
  return <Navigate to={base} replace />
}

// Sistema nativo migrado do iframe de https://analyticsdp.mendoncagalvao.com.br
// (repo ANALYTICS-DP, título original "Mendonça Galvão - Analytics") — dashboard
// de workforce/folha de pagamento (headcount, provisões trabalhistas, custo de
// pessoal). Auth própria: gate de senha compartilhada (não é Supabase nem o
// Bearer JWT do CRM — decisão de projeto documentada, este sistema fica fora
// do SSO do CRM, igual ao Documentação Contábil/Consulta CNPJ). A LoginGate
// original continua sendo a primeira coisa renderizada, embutida aqui em vez
// de em unifiedAuth.ts. Rotas planas sob useNativeSystemBase, Topbar
// portalizado pro Header do CRM — mesmo padrão do Documentação
// Contábil/Consulta CNPJ (ver documentacao-contabil/DocumentacaoContabilApp.tsx).
// QueryClientProvider é o global do CRM (ver src/App.tsx) — não cria um
// provider próprio (o original tinha um QueryClient local só porque rodava
// sozinho fora do CRM).
export default function AnalyticsDpApp() {
  return (
    <LoginGate>
      <div className="analytics-dp-root min-h-screen">
        <Toaster position="top-right" toastOptions={{ className: 'bg-card text-text-primary border border-border' }} />
        <Topbar />
        <main className="mx-auto max-w-7xl px-6 py-8">
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="imports" element={<ImportsPage />} />
            <Route path="quality" element={<QualityPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="personnel-cost" element={<PersonnelCostPage />} />
            <Route path="*" element={<NotFoundRedirect />} />
          </Routes>
        </main>
      </div>
    </LoginGate>
  )
}
