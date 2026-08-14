import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@mg/ui'
import { Carregando, ErroCarregamento } from '../components/Comuns'
import { useMeusAceites, usePoliticaVigente, useRegistrarAceite } from './usePortal'

/**
 * Aceite da política de privacidade.
 *
 * Requisito de LGPD, não enfeite: registra QUANDO e QUAL VERSÃO do texto foi
 * aceita. Por isso o texto aparece inteiro antes do botão — aceite de texto
 * que a pessoa não teve como ler não demonstra nada.
 *
 * Fica antes de qualquer dado da empresa: enquanto não houver aceite da versão
 * vigente, o portal não mostra obrigação nem documento.
 */
export function AceiteGate({
  acessoId,
  children,
}: {
  acessoId: string
  children: React.ReactNode
}) {
  const politica = usePoliticaVigente()
  const aceites = useMeusAceites()
  const registrar = useRegistrarAceite()
  const [marcado, setMarcado] = useState(false)

  if (politica.isLoading || aceites.isLoading) return <Carregando />
  if (politica.isError) return <ErroCarregamento erro={politica.error} />

  // Sem política publicada não há o que aceitar — não trava o cliente fora do
  // portal por uma configuração que é do escritório.
  if (!politica.data) return <>{children}</>

  const jaAceitou = (aceites.data ?? []).some(
    (a) => a.versao_politica === politica.data!.versao,
  )
  if (jaAceitou) return <>{children}</>

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
          <div>
            <h1 className="text-lg text-text-primary">Política de privacidade</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Versão {politica.data.versao}. Leia antes de continuar.
            </p>
          </div>
        </div>

        <div className="mt-5 max-h-80 overflow-y-auto rounded-lg border border-border-subtle bg-card-alt p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
            {politica.data.texto}
          </p>
        </div>

        <label className="mt-5 flex items-start gap-2.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={marcado}
            onChange={(e) => setMarcado(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border bg-card"
          />
          <span>
            Li e concordo com a política de privacidade na versão {politica.data.versao}.
          </span>
        </label>

        <div className="mt-5 flex items-center gap-3">
          <Button
            disabled={!marcado || registrar.isPending}
            onClick={() => registrar.mutate({ acessoId, politica: politica.data! })}
          >
            {registrar.isPending ? 'Registrando…' : 'Concordar e continuar'}
          </Button>
          <span className="text-xs text-text-muted">
            A data e a versão do aceite ficam registradas.
          </span>
        </div>

        {registrar.isError && (
          <p role="alert" className="mt-4 rounded-lg bg-error-soft px-3 py-2 text-sm text-error">
            {(registrar.error as Error).message}
          </p>
        )}
      </div>
    </div>
  )
}
