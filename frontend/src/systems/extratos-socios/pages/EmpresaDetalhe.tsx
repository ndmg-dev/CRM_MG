import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Calendar, FileX2, AlertTriangle, ExternalLink } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { extratosApi, extratosQueryOptions } from '../lib/api'
import { fmtBRL0, fmtCNPJ, fmtData, iniciais, mesesEsperados, MESES_CURTOS, MESES_LONGOS } from '../lib/format'
import { Card, Loading, ErrorMsg, EmptyState } from '../components/ui'
import { HeatmapGrid } from '../components/HeatmapGrid'
import type { MovimentacaoItem } from '../lib/types'

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

  // Agrupa as transações por mês (tudo de 09 junto, etc.).
  const porMes = new Map<number, MovimentacaoItem[]>()
  for (const m of data?.movimentacoes ?? []) {
    const arr = porMes.get(m.mes) ?? []
    arr.push(m)
    porMes.set(m.mes, arr)
  }
  const mesesOrdenados = [...porMes.keys()].sort((a, b) => a - b)
  const mesesComAlerta = new Set((data?.alertasLimite ?? []).map((a) => a.mes))
  const mv = data?.movimentacoes ?? []
  const temContraparte = mv.some((m) => m.contraparte)
  const temPapel = mv.some((m) => m.papel)
  const temDocumento = mv.some((m) => m.documento)

  function liquidoDoMes(itens: MovimentacaoItem[]): number {
    return itens.reduce((acc, m) => acc + (m.tipo === 'retirada' ? Number(m.valor) : -Number(m.valor)), 0)
  }

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

          {/* Alertas de limite MENSAL (um por sócio/mês) */}
          {data.alertasLimite.map((a) => (
            <div key={`${a.socio}-${a.mes}`} className="ex-alert">
              <AlertTriangle size={16} />
              <div>
                <strong>Limite mensal ultrapassado.</strong> {a.socio} movimentou {fmtBRL0(a.movimentado)} em{' '}
                {MESES_LONGOS[a.mes - 1]}/{data.ano}. Limite: {fmtBRL0(data.limiteMensal)}/mês. Excedente:{' '}
                <strong>{fmtBRL0(a.excedente)}</strong>.
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
                const excede = s.mesesAcimaLimite.length > 0
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
                      <span className="ex-socio-tag">Total movimentado (ano)</span>
                      <span className="ex-mono">{fmtBRL0(s.totalMovimentado)}</span>
                    </div>
                    {excede && (
                      <div className="ex-socio-limite">
                        <AlertTriangle size={13} /> Acima do limite em {s.mesesAcimaLimite.map((m) => MESES_CURTOS[m - 1]).join(', ')}
                      </div>
                    )}
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

          {/* Transações identificadas, agrupadas por mês */}
          <Card title="Transações identificadas" sub={`${mv.length} movimentações no ano`} className="ex-mt">
            {mv.length === 0 ? (
              <div className="ex-state">Sem movimentações registradas.</div>
            ) : (
              <div className="ex-table-wrap">
                {mesesOrdenados.map((mes) => {
                  const itens = porMes.get(mes)!
                  const net = liquidoDoMes(itens)
                  const alerta = mesesComAlerta.has(mes)
                  return (
                    <div key={mes} className="ex-mes-grupo">
                      <div className="ex-mes-head">
                        <span className="ex-mes-nome">
                          {MESES_LONGOS[mes - 1]} <span className="ex-mes-count">· {itens.length}</span>
                        </span>
                        <span className="ex-mes-tot">
                          movimentado <span className="ex-mono">{fmtBRL0(net)}</span>
                          {alerta && (
                            <span className="ex-mes-flag">
                              <AlertTriangle size={12} /> acima do limite
                            </span>
                          )}
                        </span>
                      </div>
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
                          {itens.map((m, i) => (
                            <tr key={i}>
                              <td className="ex-mono">{m.data ? fmtData(m.data) : MESES_CURTOS[m.mes - 1]}</td>
                              <td className="ex-tx-socio" title={m.socio}>{m.nomeExtrato || m.socio}</td>
                              {temContraparte && <td className="ex-tx-socio" title={m.contraparte || ''}>{m.contraparte || '—'}</td>}
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
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
