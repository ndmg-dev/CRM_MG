import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { extratosApi, extratosQueryOptions } from '../lib/api'
import { fmtBRL, fmtCNPJ } from '../lib/format'
import { Card, Loading, ErrorMsg, Empty } from '../components/ui'
import { HeatmapGrid } from '../components/HeatmapGrid'

const ANO_ATUAL = new Date().getFullYear()

export default function EmpresaDetalhe() {
  const { clientId } = useParams<{ clientId: string }>()
  const [params] = useSearchParams()
  const ano = Number(params.get('ano')) || ANO_ATUAL
  const navigate = useNavigate()
  const toAbs = useNativeSystemPath()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['extratos', 'empresa', clientId, ano],
    queryFn: () => extratosApi.empresa(clientId!, ano),
    enabled: Boolean(clientId),
    ...extratosQueryOptions,
  })

  const monthLinks: Record<number, string | null> = {}
  for (const m of data?.meses ?? []) monthLinks[m.mes] = m.driveUrl

  return (
    <div>
      <button type="button" className="ex-back" onClick={() => navigate(`${toAbs('.')}?ano=${ano}`)}>
        <ArrowLeft size={16} /> Voltar
      </button>

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorMsg error={error} />
      ) : !data ? (
        <Empty>Empresa não encontrada.</Empty>
      ) : (
        <>
          <div className="ex-page-head">
            <div>
              <h2 className="ex-page-title">{data.razaoSocial || '(sem razão social)'}</h2>
              <p className="ex-page-sub">
                {fmtCNPJ(data.cnpj)} · ano {data.ano}
              </p>
            </div>
          </div>

          <Card title="Consolidado por sócio">
            {data.socios.length === 0 ? (
              <Empty>Nenhum sócio consolidado para {data.ano}.</Empty>
            ) : (
              <div className="ex-socio-grid">
                {data.socios.map((s) => (
                  <div key={s.socio} className="ex-socio-card">
                    <div className="ex-socio-nome">{s.socio}</div>
                    <div className="ex-socio-vals">
                      <div className="ex-socio-val ret">
                        <ArrowDownCircle size={15} />
                        <div>
                          <span className="ex-socio-val-label">Retiradas</span>
                          <span className="ex-socio-val-num">{fmtBRL(s.totalRetiradas)}</span>
                        </div>
                      </div>
                      <div className="ex-socio-val apo">
                        <ArrowUpCircle size={15} />
                        <div>
                          <span className="ex-socio-val-label">Aportes</span>
                          <span className="ex-socio-val-num">{fmtBRL(s.totalAportes)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Grade mês × sócio" className="ex-mt" action={<span className="ex-card-hint">clique num mês processado para abrir o PDF</span>}>
            {data.socios.length === 0 ? (
              <Empty>Sem movimentações para montar a grade.</Empty>
            ) : (
              <div className="ex-heatmap-scroll">
                <HeatmapGrid
                  ano={data.ano}
                  rows={data.socios.map((s) => ({
                    nome: s.socio,
                    totalRetiradas: s.totalRetiradas,
                    totalAportes: s.totalAportes,
                    meses: s.meses,
                  }))}
                  monthLinks={monthLinks}
                />
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
