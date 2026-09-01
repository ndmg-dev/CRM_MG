import { Routes, Route, Navigate } from 'react-router-dom'
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase'
import { Topbar } from './components/Topbar'
import Overview from './pages/Overview'
import Historico from './pages/Historico'
import RedeFirewall from './pages/RedeFirewall'
import SnapshotsBackups from './pages/SnapshotsBackups'
import AcoesAuditoria from './pages/AcoesAuditoria'

import './styles/vps-monitor.css'

// Monitoramento nativo da VPS Hostinger onde o próprio CRM roda (aba
// Tecnologia/TI). Fase 1: 100% leitura, só a Hostinger API — via o proxy
// com cache em app/api/v1/endpoints/vps_monitor.py. Segue o padrão estrutural
// do ContAI/Analytics DP: rotas planas sob useNativeSystemBase, Topbar
// portalizado pro Header do CRM, CSS escopado em .vps-monitor-root.
// Reaproveita o QueryClient do CRM (SystemViewer já roda dentro dele).
function NotFoundRedirect() {
  const base = useNativeSystemBase()
  return <Navigate to={base} replace />
}

export default function VpsMonitorApp() {
  return (
    <div className="vps-monitor-root">
      <Topbar />
      <main className="vm-main">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="historico" element={<Historico />} />
          <Route path="rede" element={<RedeFirewall />} />
          <Route path="backups" element={<SnapshotsBackups />} />
          <Route path="acoes" element={<AcoesAuditoria />} />
          <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      </main>
    </div>
  )
}
