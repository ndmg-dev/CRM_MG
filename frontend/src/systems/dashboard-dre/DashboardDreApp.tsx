import { DatasetProvider } from './components/DatasetProvider'
import { Sidebar } from './components/Sidebar'
import { CabecalhoTela } from './components/CabecalhoTela'
import { Filtros } from './components/Filtros'
import { EscopoInfo } from './components/EscopoInfo'
import { KpiRow } from './components/KpiRow'
import { WaterfallDre } from './components/WaterfallDre'
import { Tendencias } from './components/Tendencias'

import './styles/globals.css'

// Fase 1 da migração nativa: só a tela "Visão geral" (KPIs, cascata da DRE,
// tendências) — Comparativo, Composição, Drilldown e Insights (+ Assistente
// de IA e Anotações, que dependem de Postgres/OpenAI do projeto original)
// ficam para fases seguintes. Ver Sidebar.tsx e lib/telas.ts.
function VisaoGeral() {
  return (
    <div className="flex flex-col gap-4">
      <KpiRow />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WaterfallDre />
        <Tendencias />
      </div>
    </div>
  )
}

export default function DashboardDreApp() {
  return (
    <div className="dashboard-dre-root">
      <DatasetProvider>
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1 px-5 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
              <CabecalhoTela />
              <Filtros />
              <EscopoInfo />
              <VisaoGeral />
            </div>
          </main>
        </div>
      </DatasetProvider>
    </div>
  )
}
