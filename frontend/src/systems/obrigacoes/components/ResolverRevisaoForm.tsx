import { useState } from 'react'
import { Button, Modal } from '@mg/ui'
import { Campo, SelectNativo } from './Campo'
import { Carregando } from './Comuns'
import { useCandidatasRevisao, useResolverRevisao } from '../hooks/useObrigacoes'
import { formatarCompetencia, formatarData } from '../lib/formato'
import type { ItemRevisao } from '../types'

/**
 * Vincula um recibo da fila de revisão à entrega correta.
 *
 * As candidatas vêm do banco (`candidatas_para_revisao`), filtradas pela
 * empresa cujo CNPJ o parser leu — não é uma lista de todas as entregas do
 * escritório. A escolha final continua sendo humana: este módulo nunca baixa
 * no palpite.
 */
export function ResolverRevisaoForm({
  item,
  onFechar,
}: {
  item: ItemRevisao
  onFechar: () => void
}) {
  const [entregaId, setEntregaId] = useState('')
  const [erroLocal, setErroLocal] = useState('')
  const candidatas = useCandidatasRevisao(item.id)
  const resolver = useResolverRevisao()

  const salvar = async () => {
    if (!entregaId) {
      setErroLocal('Escolha a entrega correspondente.')
      return
    }
    setErroLocal('')
    try {
      await resolver.mutateAsync({ itemId: item.id, entregaId })
      onFechar()
    } catch {
      // Mensagem exibida abaixo.
    }
  }

  const falha = erroLocal || (resolver.error ? (resolver.error as Error).message : '')

  return (
    <Modal
      open
      onOpenChange={(o) => { if (!o) onFechar() }}
      title="Vincular recibo a uma entrega"
      description="A entrega escolhida será baixada com origem automática e o recibo anexado."
      actions={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={resolver.isPending}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={resolver.isPending || !candidatas.data?.length}>
            {resolver.isPending ? 'Vinculando…' : 'Vincular e dar baixa'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-3 gap-3 rounded-lg border border-border-subtle bg-card-alt p-3 font-mono text-xs">
          <div>
            <dt className="text-text-muted">CNPJ lido</dt>
            <dd className="mt-0.5 text-text-primary">{item.cnpj_lido ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Obrigação</dt>
            <dd className="mt-0.5 text-text-primary">{item.codigo_obrigacao_lido ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Competência</dt>
            <dd className="mt-0.5 text-text-primary">{item.competencia_lida ?? '—'}</dd>
          </div>
        </dl>

        {candidatas.isLoading ? (
          <Carregando label="Buscando entregas…" />
        ) : candidatas.data?.length ? (
          <Campo label="Entrega correspondente" obrigatorio>
            {(p) => (
              <SelectNativo
                {...p}
                value={entregaId}
                onChange={(e) => setEntregaId(e.target.value)}
                vazio="Selecione…"
                opcoes={candidatas.data.map((c) => ({
                  valor: c.entrega_id,
                  rotulo: `${c.obrigacao} · ${formatarCompetencia(c.competencia)} · vence ${formatarData(c.vencimento)}`,
                }))}
              />
            )}
          </Campo>
        ) : (
          <p className="text-sm text-text-secondary">
            {item.cnpj_lido
              ? 'Nenhuma entrega em aberto para a empresa deste CNPJ. Verifique a parametrização ou descarte o recibo.'
              : 'O parser não conseguiu ler o CNPJ, então não há como sugerir entregas. Descarte o recibo ou corrija a origem do arquivo.'}
          </p>
        )}

        {falha && (
          <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-sm text-error">
            {falha}
          </p>
        )}
      </div>
    </Modal>
  )
}
