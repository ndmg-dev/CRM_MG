import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, FileSpreadsheet, Link as LinkIcon, CheckCheck, RefreshCw, Loader2 } from 'lucide-react'
import { extratosApi, extratosQueryOptions } from '../lib/api'
import { fmtCNPJ, MESES_CURTOS } from '../lib/format'
import { ErrorMsg, EmptyState, Skeleton } from '../components/ui'
import { VincularModal } from '../components/VincularModal'

function iconeArquivo(nome: string | null) {
  const ext = (nome || '').split('.').pop()?.toLowerCase()
  return ext === 'ofx' || ext === 'csv' || ext === 'xls' || ext === 'xlsx' ? FileSpreadsheet : FileText
}

export default function NaoVinculados() {
  const [vinculando, setVinculando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['extratos', 'nao-vinculados'],
    queryFn: () => extratosApi.naoVinculados(),
    ...extratosQueryOptions,
  })

  const reprocessar = useMutation({
    mutationFn: () => extratosApi.reprocessar(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['extratos'] })
      setAviso(
        res.vinculados > 0
          ? `${res.vinculados} extrato${res.vinculados === 1 ? '' : 's'} vinculado${res.vinculados === 1 ? '' : 's'} ao cadastro atual.`
          : 'Nenhum órfão casou com o cadastro atual.',
      )
      setTimeout(() => setAviso(null), 3500)
    },
  })

  return (
    <div>
      {aviso && <div className="ex-toast">{aviso}</div>}
      {vinculando && (
        <VincularModal
          cnpj={vinculando}
          onClose={() => setVinculando(null)}
          onDone={(n) => {
            setVinculando(null)
            setAviso(`Vínculo criado · ${n} extrato${n === 1 ? '' : 's'} reprocessado${n === 1 ? '' : 's'}.`)
            setTimeout(() => setAviso(null), 3500)
          }}
        />
      )}
      <div className="ex-page-head">
        <div>
          <h2 className="ex-page-title">Extratos não vinculados</h2>
          <p className="ex-page-sub">
            Extratos cujo CNPJ não casou com nenhum cliente cadastrado. Reprocesse para religar os que já têm cliente, ou vincule manualmente.
          </p>
        </div>
        {data && data.length > 0 && (
          <button type="button" className="ex-btn-reprocessar" onClick={() => reprocessar.mutate()} disabled={reprocessar.isPending}>
            {reprocessar.isPending ? <Loader2 size={15} className="ex-spin" /> : <RefreshCw size={15} />}
            Reprocessar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="ex-skeleton-list">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: 56, borderRadius: 12 }} />
          ))}
        </div>
      ) : isError ? (
        <ErrorMsg error={error} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={CheckCheck} title="Tudo vinculado" tone="apo">
          Nenhum extrato pendente de vínculo. Novos extratos sem correspondência aparecerão aqui.
        </EmptyState>
      ) : (
        <div className="ex-table">
          <div className="ex-table-head">
            <div>CNPJ do extrato</div>
            <div>Período</div>
            <div>Arquivo</div>
            <div>Motivo</div>
            <div />
          </div>
          {data.map((e) => {
            const Icone = iconeArquivo(e.arquivoOrigem)
            return (
              <div key={e.id} className="ex-table-row">
                <div className="ex-mono ex-td-cnpj">{fmtCNPJ(e.cnpj)}</div>
                <div className="ex-td-periodo">
                  {MESES_CURTOS[e.mes - 1]} / {e.ano}
                </div>
                <div className="ex-td-arquivo">
                  <Icone size={15} />
                  <span className="ex-mono" title={e.arquivoOrigem || ''}>
                    {e.arquivoOrigem || '—'}
                  </span>
                </div>
                <div>
                  <span className="ex-badge-motivo">CNPJ não cadastrado</span>
                </div>
                <div>
                  <button type="button" className="ex-btn-vincular" onClick={() => setVinculando(e.cnpj)}>
                    <LinkIcon size={14} /> Vincular
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
