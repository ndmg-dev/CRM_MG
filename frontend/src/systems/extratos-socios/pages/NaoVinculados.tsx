import { useQuery } from '@tanstack/react-query'
import { FileText, FileSpreadsheet, Link as LinkIcon, CheckCheck } from 'lucide-react'
import { extratosApi, extratosQueryOptions } from '../lib/api'
import { fmtCNPJ, MESES_CURTOS } from '../lib/format'
import { ErrorMsg, EmptyState, Skeleton } from '../components/ui'

function iconeArquivo(nome: string | null) {
  const ext = (nome || '').split('.').pop()?.toLowerCase()
  return ext === 'ofx' || ext === 'csv' || ext === 'xls' || ext === 'xlsx' ? FileSpreadsheet : FileText
}

export default function NaoVinculados() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['extratos', 'nao-vinculados'],
    queryFn: () => extratosApi.naoVinculados(),
    ...extratosQueryOptions,
  })

  return (
    <div>
      <div className="ex-page-head">
        <div>
          <h2 className="ex-page-title">Extratos não vinculados</h2>
          <p className="ex-page-sub">
            Extratos cujo CNPJ não casou com nenhum cliente cadastrado. Vincule-os para que as movimentações entrem no consolidado.
          </p>
        </div>
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
                  <button type="button" className="ex-btn-vincular" disabled title="Vinculação manual — em breve">
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
