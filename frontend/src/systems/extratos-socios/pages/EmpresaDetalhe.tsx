import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Calendar, FileX2, AlertTriangle, ExternalLink } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { extratosApi, extratosQueryOptions } from '../lib/api'
import { fmtBRL0, fmtCNPJ, fmtData, iniciais, mesesEsperados, MESES_CURTOS } from '../lib/format'
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
  const limite = Number(data?.limiteAnual ?? 0)
  const acima = (data?.socios ?? []).filter((s) => Number(s.excedente) > 0)

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

          {/* Alertas de limite operacional */}
          {acima.map((s) => (
            <div key={s.socio} className="ex-alert">
              <AlertTriangle size={16} />
              <div>
                <strong>Limite anual ultrapassado.</strong> {s.socio} movimentou {fmtBRL0(s.totalMovimentado)} em {data.ano}.
                Limite operacional: {fmtBRL0(limite)}. Excedente: <strong>{fmtBRL0(s.excedente)}</strong>.
              </div>
            </div>
          ))}

          <div className="ex-section-label">Consolidado por sócio</div>
          {data.socios.length === 0 ? (
            <EmptyState icon={FileX2} title={`Sem sócios consolidados em ${data.ano}`}>
              Quando houver movimentações de sócios no ano, os totais de retiradas e aportes aparecem aqui.
            </EmptyState>
          ) : (
            <div className="ex-socio-grid">
              {data.socios.map((s) => {
                const excede = Number(s.excedente) > 0
                return (
                  <div key={s.socio} className={`ex-socio-card ${excede ? 'alerta' : ''}`}>
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
                    <div className="ex-socio-line total">
                      <span className="ex-socio-tag">
                        Total movimentado
                        {excede && <span className="ex-tag-excede">acima do limite</span>}
                      </span>
                      <span className={`ex-mono ${excede ? 'ex-val-ret' : ''}`}>{fmtBRL0(s.totalMovimentado)}</span>
                    </div>
                  </div>
                )
              })}
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

          {/* Transações identificadas. Colunas opcionais (contraparte, papel,
              documento) só aparecem quando o n8n envia esses campos. */}
          {(() => {
            const mv = data.movimentacoes
            const temContraparte = mv.some((m) => m.contraparte)
            const temPapel = mv.some((m) => m.papel)
            const temDocumento = mv.some((m) => m.documento)
            return (
              <Card title="Transações identificadas" sub={`${mv.length} movimentações no ano`} className="ex-mt">
                {mv.length === 0 ? (
                  <div className="ex-state">Sem movimentações registradas.</div>
                ) : (
                  <div className="ex-table-wrap">
                    <table className="ex-tx-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Sócio</th>
                          {temContraparte && <th>Contraparte</th>}
                          {temPapel && <th>Papel</th>}
                          <th>Histórico</th>
                          {temDocumento && <th>Documento</th>}
                          <th>Tipo</th>
                          <th className="right">Valor</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {mv.map((m, i) => (
                          <tr key={i}>
                            <td className="ex-mono">{m.data ? fmtData(m.data) : MESES_CURTOS[m.mes - 1]}</td>
                            <td className="ex-tx-socio" title={m.socio}>{m.nomeExtrato || m.socio}</td>
                            {temContraparte && (
                              <td className="ex-tx-socio" title={m.contraparte || ''}>{m.contraparte || '—'}</td>
                            )}
                            {temPapel && <td>{m.papel || '—'}</td>}
                            <td className="ex-tx-hist" title={m.historico || m.descricao || ''}>{m.historico || m.descricao || '—'}</td>
                            {temDocumento && <td className="ex-mono">{m.documento || '—'}</td>}
                            <td>
                              <span className={`ex-tx-tipo ${m.tipo}`}>{m.tipo === 'retirada' ? 'Débito' : 'Crédito'}</span>
                            </td>
                            <td className={`right ex-mono ${m.tipo === 'retirada' ? 'ex-val-ret' : 'ex-val-apo'}`}>{fmtBRL0(m.valor)}</td>
                            <td>
                              {m.driveUrl && (
                                <a className="ex-link" href={m.driveUrl} target="_blank" rel="noopener noreferrer" title="Abrir PDF do mês">
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )
          })()}
        </>
      )}
    </div>
  )
}
