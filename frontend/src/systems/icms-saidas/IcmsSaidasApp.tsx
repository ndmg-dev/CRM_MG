import { Routes, Route, Navigate } from 'react-router-dom'
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase'
import { PERMISSOES, ProvedorPermissoes, RequerAdmin, RequerPermissao } from './auth/permissoes'
import { Topbar } from './components/Topbar'
import { Empresa } from './paginas/Empresa'
import { NovaEmpresa } from './paginas/NovaEmpresa'
import { Painel } from './paginas/Painel'
import { Permissoes } from './paginas/Permissoes'
import { Regras } from './paginas/regras/Regras'
import { TelaCarregando } from './ui/components/TelaCarregando'

import './ui/tokens.css'
import './ui/base.css'
import './ui/layout.css'

// Módulo "ICMS Saídas" (setor Fiscal): apuração mensal de Outros Débitos / Estornos de Débito a partir do relatório de vendas.
// A UI vive aqui; o cálculo e a memória tributária ficam no motor (repo motor-calculos), que só o backend do CRM chama
// (app/api/v1/endpoints/icms_saidas.py): o navegador nunca fala com o motor nem conhece a chave dele.
// Padrão dos demais sistemas nativos: rotas planas sob useNativeSystemBase, Topbar portalizado pro Header do CRM, CSS escopado em .icms-root.
function NotFoundRedirect() {
  const base = useNativeSystemBase()
  return <Navigate to={base} replace />
}

export default function IcmsSaidasApp() {
  return (
    <div className="icms-root">
      <ProvedorPermissoes>
        <TelaCarregando />
        <Topbar />
        <Routes>
          <Route index element={<RequerPermissao permissao={PERMISSOES.consultar}><Painel /></RequerPermissao>} />
          <Route path="empresas/:codigo" element={<RequerPermissao permissao={PERMISSOES.consultar}><Empresa /></RequerPermissao>} />
          <Route path="regras" element={<RequerPermissao permissao={PERMISSOES.consultar}><Regras /></RequerPermissao>} />
          <Route
            path="admin/empresas/nova"
            element={<RequerPermissao permissao={PERMISSOES.gerirEmpresas}><NovaEmpresa /></RequerPermissao>}
          />
          <Route path="permissoes" element={<RequerAdmin><Permissoes /></RequerAdmin>} />
          <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      </ProvedorPermissoes>
    </div>
  )
}
