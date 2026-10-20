import { Routes, Route, Navigate } from 'react-router-dom'
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase'
import { Topbar } from './components/Topbar'
import Dashboard from './pages/Dashboard'
import EmpresaDetalhe from './pages/EmpresaDetalhe'
import NaoVinculados from './pages/NaoVinculados'

import './styles/extratos-socios.css'

// Módulo "Extratos de Sócios" (setor Contábil): espelho somente-leitura dos
// extratos de sócios processados pelo n8n, consolidado por empresa. Lê do
// backend em app/api/v1/endpoints/extratos.py. Segue o padrão do vps-monitor:
// rotas planas sob useNativeSystemBase, Topbar portalizado pro Header do CRM,
// CSS escopado em .extratos-root, reusa o QueryClient do CRM.
function NotFoundRedirect() {
  const base = useNativeSystemBase()
  return <Navigate to={base} replace />
}

export default function ExtratosSociosApp() {
  return (
    <div className="extratos-root">
      <Topbar />
      <main className="ex-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="empresa/:clientId" element={<EmpresaDetalhe />} />
          <Route path="nao-vinculados" element={<NaoVinculados />} />
          <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      </main>
    </div>
  )
}
