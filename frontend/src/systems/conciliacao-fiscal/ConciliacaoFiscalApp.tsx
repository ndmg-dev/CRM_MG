import { Routes, Route, Navigate } from 'react-router-dom'
import { Topbar } from './components/Topbar'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import NewCompany from './pages/NewCompany'
import CompanyDetails from './pages/CompanyDetails'
import ReconciliationReport from './pages/ReconciliationReport'
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase'

import './styles/globals.css'

function NotFoundRedirect() {
  const base = useNativeSystemBase()
  return <Navigate to={base} replace />
}

export default function ConciliacaoFiscalApp() {
  return (
    <div className="fiscal-root">
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      <Topbar />
      <main className="main-content animate-fade-in">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="companies" element={<Companies />} />
          <Route path="companies/new" element={<NewCompany />} />
          <Route path="companies/:companyId" element={<CompanyDetails />} />
          <Route path="reconciliations/:companyId/:periodo" element={<ReconciliationReport />} />
          <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      </main>
    </div>
  )
}
