import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Building2, CalendarDays, ChevronLeft, ChevronRight, FileWarning,
  LayoutDashboard, ListChecks, Settings2,
} from 'lucide-react'
import { SessionGate } from './components/SessionGate'
import { useSessao } from './hooks/useObrigacoes'
import { Painel } from './pages/Painel'
import { Entregas } from './pages/Entregas'
import { Empresas } from './pages/Empresas'
import { Catalogo } from './pages/Catalogo'
import { Agenda } from './pages/Agenda'
import { Revisao } from './pages/Revisao'
import { Parametrizacao } from './pages/Parametrizacao'
import {
  competenciaAtual, deslocarCompetencia, formatarCompetencia,
} from './lib/formato'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

type Secao =
  | 'painel' | 'empresas' | 'catalogo' | 'entregas'
  | 'agenda' | 'revisao' | 'parametrizacao'

const NAVEGACAO: { id: Secao; rotulo: string; icone: React.ComponentType<{ className?: string }> }[] = [
  { id: 'painel',         rotulo: 'Painel',         icone: LayoutDashboard },
  { id: 'entregas',       rotulo: 'Entregas',       icone: ListChecks },
  { id: 'empresas',       rotulo: 'Empresas',       icone: Building2 },
  { id: 'catalogo',       rotulo: 'Obrigações',     icone: ListChecks },
  { id: 'agenda',         rotulo: 'Agenda',         icone: CalendarDays },
  { id: 'revisao',        rotulo: 'Revisão',        icone: FileWarning },
  { id: 'parametrizacao', rotulo: 'Parametrização', icone: Settings2 },
]

/** Seções que dependem de uma competência selecionada. */
const COM_COMPETENCIA: Secao[] = ['painel', 'entregas', 'empresas']

function Shell() {
  const [secao, setSecao] = useState<Secao>('painel')
  const [competencia, setCompetencia] = useState(competenciaAtual())
  const [empresaFoco, setEmpresaFoco] = useState<string | null>(null)
  const { data: sessao } = useSessao()

  const abrirParametrizacao = (empresaId: string) => {
    setEmpresaFoco(empresaId)
    setSecao('parametrizacao')
  }

  return (
    <div className="obrigacoes-root min-h-screen bg-background p-4 text-text-primary sm:p-6">
      <header className="mb-5 border-b border-divider pb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
          Núcleo Digital · Obrigações Acessórias
        </p>
        <h1 className="mt-1 text-2xl text-text-primary">Controle de entregas</h1>
        {sessao?.perimetro === 'COLABORADOR' && (
          <p className="mt-1 text-sm text-text-secondary">
            {sessao.papel === 'ADMIN'
              ? 'Acesso administrativo a todos os departamentos.'
              : `Departamentos: ${sessao.departamentos.join(', ') || 'nenhum atribuído'}`}
          </p>
        )}
      </header>

      <nav className="mb-5 flex flex-wrap items-center gap-1" aria-label="Seções">
        {NAVEGACAO.map(({ id, rotulo, icone: Icone }) => (
          <button
            key={id}
            onClick={() => setSecao(id)}
            aria-current={secao === id ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gold-border ${
              secao === id
                ? 'bg-gold-soft text-gold'
                : 'text-text-secondary hover:bg-surface hover:text-text-primary'
            }`}
          >
            <Icone className="h-4 w-4" aria-hidden="true" />
            {rotulo}
          </button>
        ))}
      </nav>

      {COM_COMPETENCIA.includes(secao) && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-text-muted">Competência</span>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
            <button
              onClick={() => setCompetencia((c) => deslocarCompetencia(c, -1))}
              aria-label="Competência anterior"
              className="rounded p-1 text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-gold-border"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-16 text-center font-mono text-sm text-text-primary">
              {formatarCompetencia(competencia)}
            </span>
            <button
              onClick={() => setCompetencia((c) => deslocarCompetencia(c, 1))}
              aria-label="Próxima competência"
              className="rounded p-1 text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-gold-border"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <main>
        {secao === 'painel' && <Painel competencia={competencia} />}
        {secao === 'entregas' && <Entregas competencia={competencia} />}
        {secao === 'empresas' && (
          <Empresas competencia={competencia} onAbrirParametrizacao={abrirParametrizacao} />
        )}
        {secao === 'catalogo' && <Catalogo />}
        {secao === 'agenda' && <Agenda />}
        {secao === 'revisao' && <Revisao />}
        {secao === 'parametrizacao' && <Parametrizacao empresaId={empresaFoco} />}
      </main>
    </div>
  )
}

/**
 * Raiz do módulo, montada pelo SystemViewer via `systems/registry.tsx`.
 *
 * Só o perímetro do ESCRITÓRIO vive aqui. O portal do cliente é aplicação
 * separada, com sessão própria — não é uma aba desta tela nem um filtro.
 */
export default function ObrigacoesApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionGate>
        <Shell />
      </SessionGate>
    </QueryClientProvider>
  )
}
