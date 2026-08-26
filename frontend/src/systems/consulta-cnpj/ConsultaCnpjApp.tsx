import { Routes, Route } from 'react-router-dom'
import { Topbar } from './components/Topbar'
import SearchPage from './pages/SearchPage'
import ResultPage from './pages/ResultPage'

import './styles/global.css'

// Sistema nativo migrado do iframe de https://consultacnpj.mendoncagalvao.com.br
// (repo CONSULTA-SOCIETARIO) — sem autenticação própria (decisão do sistema
// original, mesmo caso do Documentação Contábil). Rotas planas sob
// useNativeSystemBase, Topbar portalizado pro Header do CRM.
export default function ConsultaCnpjApp() {
  return (
    <div className="consulta-cnpj-root app-shell">
      <Topbar />
      <main className="page-container">
        <Routes>
          <Route index element={<SearchPage />} />
          <Route path="resultado/:cnpj" element={<ResultPage />} />
        </Routes>
      </main>
    </div>
  )
}
