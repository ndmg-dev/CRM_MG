import { AlertTriangle, CheckCircle2, Clock, Download, FileText } from 'lucide-react'
import { Button } from '@mg/ui'
import { Carregando, ChipStatus, ErroCarregamento, Indicador, Secao, TrilhoPrazo, Vazio } from '../components/Comuns'
import { formatarCnpj, formatarCompetencia, formatarData } from '../lib/formato'
import { formatarTamanho } from '../lib/arquivo'
import { Upload } from './Upload'
import {
  useBaixarDocumento, useMeusDocumentos, useMinhaEmpresa, useMinhasObrigacoes, useResumoPortal,
} from './usePortal'
import type { Documento } from './usePortal'

// ------------------------------------------------------------------ início

export function Inicio({ competencia, acessoId }: { competencia: string; acessoId: string }) {
  const empresa = useMinhaEmpresa()
  const resumo = useResumoPortal(competencia)
  const obrigacoes = useMinhasObrigacoes(competencia)

  if (empresa.isError) return <ErroCarregamento erro={empresa.error} />

  const aguardando = (obrigacoes.data ?? []).filter((o) => o.status === 'AGUARDANDO_CLIENTE')

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        {empresa.isLoading ? (
          <Carregando />
        ) : empresa.data ? (
          <>
            <h1 className="text-xl text-text-primary">
              {empresa.data.nome_fantasia || empresa.data.razao_social}
            </h1>
            <p className="mt-1 font-mono text-xs text-text-muted">
              {formatarCnpj(empresa.data.cnpj)}
            </p>
            <p className="mt-4 text-sm text-text-secondary">
              {aguardando.length === 0
                ? 'Nenhum documento pendente no momento. Obrigado!'
                : `${aguardando.length} ${aguardando.length === 1 ? 'obrigação aguarda' : 'obrigações aguardam'} o envio de documentos.`}
            </p>
          </>
        ) : (
          <Vazio>Não encontramos os dados da sua empresa.</Vazio>
        )}
      </div>

      {resumo.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador icone={FileText} valor={resumo.data.total}
                     rotulo={`Obrigações em ${formatarCompetencia(competencia)}`} />
          <Indicador icone={CheckCircle2} valor={resumo.data.entregues}
                     rotulo="Concluídas" tom="text-success" />
          <Indicador icone={Clock} valor={resumo.data.aguardando_cliente}
                     rotulo="Aguardando você" tom="text-warning" />
          <Indicador icone={AlertTriangle} valor={resumo.data.atrasadas}
                     rotulo="Em atraso" tom="text-error" />
        </div>
      )}

      {aguardando.length > 0 && (
        <Secao titulo="Documentos solicitados">
          <ul className="divide-y divide-divider">
            {aguardando.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
                <div>
                  <div className="text-sm text-text-primary">{o.obrigacao?.nome}</div>
                  <div className="text-xs text-text-muted">
                    competência {formatarCompetencia(o.competencia)} · prazo {formatarData(o.vencimento)}
                  </div>
                </div>
                <Upload acessoId={acessoId} entregaId={o.id} />
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
  )
}

// ------------------------------------------------------ minhas obrigações

export function MinhasObrigacoes({
  competencia,
  acessoId,
}: {
  competencia: string
  acessoId: string
}) {
  const { data, isLoading, isError, error } = useMinhasObrigacoes(competencia)

  if (isError) return <ErroCarregamento erro={error} />
  if (isLoading) return <Carregando label="Carregando obrigações…" />

  if (!data?.length) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <Vazio>Nenhuma obrigação nesta competência.</Vazio>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {data.map((o) => (
        <li key={o.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-text-primary">{o.obrigacao?.nome}</div>
              <div className="font-mono text-xs text-text-muted">
                competência {formatarCompetencia(o.competencia)} · prazo {formatarData(o.vencimento)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <TrilhoPrazo prazo={o.vencimento} status={o.status} />
              <ChipStatus status={o.status} />
              {/* Envio disponível enquanto a obrigação não foi concluída —
                  documento complementar é comum, não exceção. */}
              {o.status !== 'ENTREGUE' && o.status !== 'DISPENSADA' && (
                <Upload acessoId={acessoId} entregaId={o.id} rotulo="Enviar" />
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

// -------------------------------------------------------------- documentos

const ROTULO_ORIGEM: Record<Documento['origem'], string> = {
  ESCRITORIO: 'Enviado pelo escritório',
  PORTAL_CLIENTE: 'Enviado por você',
  RECIBO_AUTOMATICO: 'Recibo da entrega',
}

export function Documentos({ acessoId }: { acessoId: string }) {
  const { data, isLoading, isError, error } = useMeusDocumentos()
  const baixar = useBaixarDocumento()

  const abrir = async (doc: Documento) => {
    try {
      const url = await baixar.mutateAsync(doc)
      // `noopener` evita que a aba aberta acesse `window.opener`.
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // Mensagem exibida abaixo.
    }
  }

  if (isError) return <ErroCarregamento erro={error} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Documentos da sua empresa. Os links de download expiram em 1 minuto.
        </p>
        <Upload acessoId={acessoId} entregaId={null} rotulo="Enviar documento" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <Carregando label="Carregando documentos…" />
        ) : data?.length ? (
          <ul className="divide-y divide-divider">
            {data.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-text-primary">{doc.nome_arquivo}</div>
                    <div className="text-xs text-text-muted">
                      {ROTULO_ORIGEM[doc.origem]} · {formatarData(doc.criado_em)} ·{' '}
                      {formatarTamanho(doc.bytes)}
                    </div>
                  </div>
                </div>

                {doc.storage_path ? (
                  <Button variant="ghost" size="sm" onClick={() => abrir(doc)}
                          disabled={baixar.isPending}>
                    <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Baixar
                  </Button>
                ) : (
                  // O espelho no GED não é o documento legal — o original é do
                  // cliente. Depois da retenção, resta o registro.
                  <span className="text-xs text-text-muted">
                    removido pela política de retenção
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Vazio>Nenhum documento disponível ainda.</Vazio>
        )}
      </div>

      {baixar.isError && (
        <p role="alert" className="text-sm text-error">{(baixar.error as Error).message}</p>
      )}
    </div>
  )
}
