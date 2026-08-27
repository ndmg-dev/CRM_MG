// @ts-nocheck
import { Navigate, Route, Routes } from 'react-router-dom'
import { AlertCircle } from 'react-feather'
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase'
import { Topbar } from './components/Topbar'
import { useDashboard } from './hooks/useDashboard'
import Overview from './pages/Overview'
import Benefits from './pages/Benefits'
import Expectations from './pages/Expectations'
import Salary from './pages/Salary'
import Tenure from './pages/Tenure'
import Roles from './pages/Roles'
import Presentation from './pages/Presentation'
import Confidential from './pages/Confidential'

import './styles/dash-rh.css'

// Sistema nativo migrado do iframe de https://dashrh.nucleodigital.cloud/
// (repo HR-DASH-MG) — dashboard de analytics de RH (visão geral, benefícios,
// expectativas, salários, tempo de casa, cargos + área restrita nominal).
// Auth: SSO via Bearer JWT do CRM (localStorage 'crm_token'), enviado em
// toda chamada por api/client.js — o gate de senha da área confidencial foi
// removido (allowlist de e-mails passou pro backend). Backend FastAPI
// hospedado à parte. Navegação: o switch de tab-state do satélite virou
// rotas planas do React Router sob useNativeSystemBase; a Sidebar vertical
// virou um Topbar portalizado pro #system-menu-slot do CRM. QueryClient e
// Router são os globais do CRM (ver src/App.tsx) — este app não cria os seus.
function NotFoundRedirect() {
  const base = useNativeSystemBase()
  return <Navigate to={base} replace />
}

export default function DashRhApp() {
  const { data, loading, hasError } = useDashboard()

  return (
    <div className="dash-rh-root">
      <Topbar />
      <main style={{ padding: 'var(--space-lg)' }}>
        {hasError && (
          <div style={{
            padding: 'var(--space-lg)',
            background: 'var(--negative-soft)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-lg)',
            color: 'var(--negative)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)'
          }}>
            <AlertCircle size={18} />
            <div>Erro ao carregar dados do servidor.</div>
          </div>
        )}
        <Routes>
          <Route index element={<Presentation data={data.presentation} loading={loading.presentation} />} />
          <Route path="overview" element={<Overview data={data.overview} loading={loading.overview} />} />
          <Route path="benefits" element={<Benefits data={data.benefits} loading={loading.benefits} />} />
          <Route path="expectations" element={<Expectations data={data.expectations} loading={loading.expectations} />} />
          <Route path="salary" element={<Salary data={data.salary} loading={loading.salary} />} />
          <Route path="tenure" element={<Tenure data={data.tenure} loading={loading.tenure} />} />
          <Route path="roles" element={<Roles data={data.roles} loading={loading.roles} />} />
          <Route path="confidential" element={<Confidential />} />
          <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      </main>
    </div>
  )
}
