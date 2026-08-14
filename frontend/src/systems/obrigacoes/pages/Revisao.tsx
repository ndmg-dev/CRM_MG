import { useState } from 'react'
import { FileWarning } from 'lucide-react'
import { Button } from '@mg/ui'
import { useDescartarRecibo, useFilaRevisao } from '../hooks/useObrigacoes'
import { Carregando, ErroCarregamento, Vazio } from '../components/Comuns'
import { ResolverRevisaoForm } from '../components/ResolverRevisaoForm'
import { formatarData } from '../lib/formato'
import type { ItemRevisao, MotivoRevisao } from '../types'

const ROTULO_MOTIVO: Record<MotivoRevisao, string> = {
  empresa_nao_encontrada: 'Empresa não encontrada',
  entrega_nao_parametrizada: 'Entrega não parametrizada',
  dados_ilegiveis: 'Recibo ilegível',
  multiplas_entregas: 'Mais de uma entrega possível',
}

const EXPLICACAO_MOTIVO: Record<MotivoRevisao, string> = {
  empresa_nao_encontrada: 'O CNPJ lido no recibo não corresponde a nenhuma empresa cadastrada.',
  entrega_nao_parametrizada: 'A obrigação existe, mas não está parametrizada para esta empresa nesta competência.',
  dados_ilegiveis: 'O parser não conseguiu extrair CNPJ, obrigação ou competência do arquivo.',
  multiplas_entregas: 'Mais de uma entrega casa com este recibo. Um humano precisa escolher — nunca se baixa no palpite.',
}

/**
 * Fila de recibos que não casaram automaticamente.
 *
 * Nada aqui é baixado por adivinhação: o recibo ou casa com exatamente uma
 * entrega (e o worker já baixou sozinho), ou vem parar nesta tela.
 */
export function Revisao() {
  const [resolvendo, setResolvendo] = useState<ItemRevisao | null>(null)
  const { data, isLoading, isError, error } = useFilaRevisao()
  const descartar = useDescartarRecibo()

  if (isError) return <ErroCarregamento erro={error} />
  if (isLoading) return <Carregando label="Carregando fila de revisão…" />

  if (!data?.length) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <Vazio>Nenhum recibo aguardando revisão.</Vazio>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {data.map((item) => (
        <li key={item.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <div className="text-sm font-medium text-text-primary">
                  {ROTULO_MOTIVO[item.motivo]}
                </div>
                <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-text-secondary">
                  {EXPLICACAO_MOTIVO[item.motivo]}
                </p>

                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-text-muted">
                  <div>
                    <dt className="inline">CNPJ lido: </dt>
                    <dd className="inline text-text-secondary">{item.cnpj_lido ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="inline">Obrigação: </dt>
                    <dd className="inline text-text-secondary">{item.codigo_obrigacao_lido ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="inline">Competência: </dt>
                    <dd className="inline text-text-secondary">{item.competencia_lida ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="inline">Recebido: </dt>
                    <dd className="inline text-text-secondary">{formatarData(item.criado_em)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => descartar.mutate(item.id)}
                disabled={descartar.isPending}
              >
                Descartar
              </Button>
              <Button size="sm" onClick={() => setResolvendo(item)}>
                Vincular a uma entrega
              </Button>
            </div>
          </div>
        </li>
      ))}

      {resolvendo && (
        <ResolverRevisaoForm item={resolvendo} onFechar={() => setResolvendo(null)} />
      )}

      {descartar.isError && (
        <p role="alert" className="text-sm text-error">
          {(descartar.error as Error).message}
        </p>
      )}
    </ul>
  )
}
