import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, Home, ListChecks, LogOut } from 'lucide-react'
import { Button } from '@mg/ui'
import { isObrigacoesSupabaseConfigured, supabase } from '../integrations/supabase/client'
import { Carregando } from '../components/Comuns'
import { competenciaAtual, deslocarCompetencia, formatarCompetencia } from '../lib/formato'
import { lerSessao } from '../lib/sessao'
import { Login } from './Login'
import { AceiteGate } from './AceiteGate'
import { Documentos, Inicio, MinhasObrigacoes } from './Paginas'
import { usePortalAcesso } from './usePortal'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

type Aba = 'inicio' | 'obrigacoes' | 'documentos'

const ABAS: { id: Aba; rotulo: string; icone: React.ComponentType<{ className?: string }> }[] = [
  { id: 'inicio', rotulo: 'Início', icone: Home },
  { id: 'obrigacoes', rotulo: 'Minhas obrigações', icone: ListChecks },
  { id: 'documentos', rotulo: 'Documentos', icone: FileText },
]

function Conteudo() {
  const [aba, setAba] = useState<Aba>('inicio')
  const [competencia, setCompetencia] = useState(competenciaAtual())

  const sessao = useQuery({ queryKey: ['portal', 'sessao'], queryFn: lerSessao })
  const acesso = usePortalAcesso()

  if (sessao.isLoading) return <Carregando />

  // Sem sessão: tela de entrada por magic link.
  if (!sessao.data) return <Login />

  /**
   * Sessão de COLABORADOR chegando ao portal é erro de perímetro, não um
   * "modo administrador". O RLS já não devolveria os dados de uma empresa
   * específica; aqui a recusa é explícita, para não parecer um portal quebrado.
   */
  if (sessao.data.perimetro !== 'CLIENTE') {
    return (
      <Aviso titulo="Área do cliente">
        Esta conta é de colaborador do escritório. O acompanhamento interno fica no CRM,
        em Obrigações Acessórias.
        <div className="mt-4">
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sair</Button>
        </div>
      </Aviso>
    )
  }

  if (acesso.isLoading) return <Carregando />
  if (!acesso.data) {
    return (
      <Aviso titulo="Acesso não encontrado">
        Sua conta autenticou, mas não está vinculada a nenhuma empresa. Fale com o seu
        contador para receber um novo convite.
        <div className="mt-4">
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sair</Button>
        </div>
      </Aviso>
    )
  }

  const acessoId = acesso.data.id

  return (
    <AceiteGate acessoId={acessoId}>
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-divider pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
              Mendonça Galvão · Portal do cliente
            </p>
            <p className="mt-1 text-sm text-text-secondary">{acesso.data.nome ?? acesso.data.email}</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-gold-border"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </header>

        <nav className="mb-5 flex flex-wrap gap-1" aria-label="Seções">
          {ABAS.map(({ id, rotulo, icone: Icone }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              aria-current={aba === id ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gold-border ${
                aba === id
                  ? 'bg-gold-soft text-gold'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <Icone className="h-4 w-4" aria-hidden="true" />
              {rotulo}
            </button>
          ))}
        </nav>

        {aba !== 'documentos' && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-text-muted">Competência</span>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
              <button onClick={() => setCompetencia((c) => deslocarCompetencia(c, -1))}
                      aria-label="Competência anterior"
                      className="rounded p-1 text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-gold-border">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-16 text-center font-mono text-sm text-text-primary">
                {formatarCompetencia(competencia)}
              </span>
              <button onClick={() => setCompetencia((c) => deslocarCompetencia(c, 1))}
                      aria-label="Próxima competência"
                      className="rounded p-1 text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-gold-border">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <main>
          {aba === 'inicio' && <Inicio competencia={competencia} acessoId={acessoId} />}
          {aba === 'obrigacoes' && <MinhasObrigacoes competencia={competencia} acessoId={acessoId} />}
          {aba === 'documentos' && <Documentos acessoId={acessoId} />}
        </main>
      </div>
    </AceiteGate>
  )
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <AlertTriangle className="h-10 w-10 text-warning" aria-hidden="true" />
      <h1 className="text-lg text-text-primary">{titulo}</h1>
      <p className="text-sm leading-relaxed text-text-secondary">{children}</p>
    </div>
  )
}

/**
 * Portal do cliente — perímetro separado do /app.
 *
 * Não passa pelo AuthGuard nem pelo SSO do CRM: o cliente não tem conta Google
 * do escritório. Autentica direto no Supabase do módulo, por magic link. É por
 * isso que é uma aplicação própria e não uma aba da tela do escritório.
 */
export default function PortalApp() {
  if (!isObrigacoesSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background">
        <Aviso titulo="Portal indisponível">
          O portal não está configurado neste ambiente. Tente novamente mais tarde ou
          fale com o seu contador.
        </Aviso>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="obrigacoes-portal min-h-screen bg-background text-text-primary">
        <Conteudo />
      </div>
    </QueryClientProvider>
  )
}
