import { DatasetProvider } from './components/DatasetProvider'
import { Sidebar } from './components/Sidebar'
import { CabecalhoTela } from './components/CabecalhoTela'
import { Filtros } from './components/Filtros'
import { EscopoInfo } from './components/EscopoInfo'
import { KpiRow } from './components/KpiRow'
import { WaterfallDre } from './components/WaterfallDre'
import { Tendencias } from './components/Tendencias'
import { Comparativo } from './components/Comparativo'
import { Composicao } from './components/Composicao'
import { Drilldown } from './components/Drilldown'
import { Insights } from './components/Insights'
import { Assistente } from './components/Assistente'
import { useFiltros } from './lib/store'

import './styles/globals.css'

// Fase 2 da migração nativa do DASH_RAZAO (Next.js): todas as 5 telas
// portadas — Visão geral, Comparativo, Composição, Drilldown, Insights —
// + o Assistente de IA e as Anotações dos Insights. A navegação entre telas
// é o mesmo `tela` do zustand (lib/store.ts) que o original usa; não há
// rota do React Router aqui (ver Sidebar.tsx). Assistente e Anotações
// chamam as API routes do próprio DASH_RAZAO (Next/Vercel) via o proxy
// server-to-server do CRM (lib/api.ts → backend dre_proxy.py) — dependem de
// OPENAI_API_KEY / POSTGRES_URL configuradas no projeto Vercel; sem elas,
// degradam sozinhos (o botão do assistente some, os Insights ficam
// somente-leitura).

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

function Telas() {
  const { tela } = useFiltros()
  return (
    <>
      {tela === 'visao-geral' && <VisaoGeral />}
      {tela === 'comparativo' && <Comparativo />}
      {tela === 'composicao' && <Composicao />}
      {tela === 'drilldown' && <Drilldown />}
      {tela === 'insights' && <Insights />}
    </>
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
              <Telas />
            </div>
          </main>
          <Assistente />
        </div>
      </DatasetProvider>
    </div>
  )
}
