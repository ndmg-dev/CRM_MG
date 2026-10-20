import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Calendar, FileX2 } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { extratosApi, extratosQueryOptions } from '../lib/api'
import { fmtBRL0, fmtCNPJ, iniciais, mesesEsperados } from '../lib/format'
import { Card, Loading, ErrorMsg, EmptyState } from '../components/ui'
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
  const rel = mesesEsperados(ano) || 12
  const mesesProcessados = data?.meses.length ?? 0

  return (
    <div>
      <button type="button" className="ex-back" onClick={() => navigate(`${toAbs('.')}?ano=${ano}`)}>
        <ArrowLeft size={15} /> Empresas
      </button>

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorMsg error={error} />
      ) : !data ? (
        <EmptyState icon={FileX2} title="Empresa não encontrada" />
      ) : (
        <>
          <div className="ex-emp-head">
            <div>
              <h1 className="ex-emp-nome">{data.razaoSocial || '(sem razão social)'}</h1>
              <div className="ex-emp-meta">
                <span className="ex-mono ex-emp-cnpj">{fmtCNPJ(data.cnpj)}</span>
                <span className="ex-badge done">{mesesProcessados}/{rel} meses processados</span>
              </div>
            </div>
            <span className="ex-chip-cal">
              <Calendar size={14} /> {data.ano}
            </span>
          </div>

          <div className="ex-section-label">Consolidado por sócio</div>
          {data.socios.length === 0 ? (
            <EmptyState icon={FileX2} title={`Sem sócios consolidados em ${data.ano}`}>
              Quando houver movimentações de sócios no ano, os totais de retiradas e aportes aparecem aqui.
            </EmptyState>
          ) : (
            <div className="ex-socio-grid">
              {data.socios.map((s) => (
                <div key={s.socio} className="ex-socio-card">
                  <div className="ex-socio-head">
                    <div className="ex-avatar">{iniciais(s.socio)}</div>
                    <div className="ex-socio-id">
                      <div className="ex-socio-nome">{s.socio}</div>
                      <div className="ex-socio-cargo">Sócio</div>
                    </div>
                  </div>
                  <div className="ex-socio-line">
                    <span className="ex-socio-tag">
                      <ArrowUpRight size={15} className="ic-ret" /> Retiradas
                    </span>
                    <span className="ex-mono ex-val-ret">{fmtBRL0(s.totalRetiradas)}</span>
                  </div>
                  <div className="ex-socio-line">
                    <span className="ex-socio-tag">
                      <ArrowDownLeft size={15} className="ic-apo" /> Aportes
                    </span>
                    <span className="ex-mono ex-val-apo">{fmtBRL0(s.totalAportes)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Card title={`Grade de extratos · ${data.ano}`} sub="Clique em um mês processado para abrir o relatório PDF" className="ex-mt">
            {data.socios.length === 0 ? (
              <div className="ex-state">Sem movimentações para montar a grade.</div>
            ) : (
              <div className="ex-heatmap-scroll">
                <HeatmapGrid
                  ano={data.ano}
                  rows={data.socios.map((s) => ({ nome: s.socio, totalRetiradas: s.totalRetiradas, totalAportes: s.totalAportes, meses: s.meses }))}
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
