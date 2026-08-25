import { useState } from 'react'
import { Calendar, CheckCircle, AlertCircle, Percent, DollarSign, Clock, Zap } from 'react-feather'
import { contaiApi, type ContaiLancamento } from '../api/client'
import { useContaiQuery } from '../hooks/useContaiQuery'
import { useEmpresa } from '../context/EmpresaContext'
import { ContaiLoading, ContaiError } from '../components/StatusView'

function formatBRL(valor?: number) {
  if (valor === undefined || valor === null) return '0,00'
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface ReportShape {
  total_lancamentos?: number
  conciliados?: number
  excecoes?: number
  taxa_conciliacao?: number
  valor_total_ofx?: number
  valor_pendente?: number
  detalhes?: Array<{
    lancamento_id: string
    status: string
    score: number
    lancamento_ofx: ContaiLancamento
    lancamento_pdf: ContaiLancamento | null
  }>
}

export default function Conciliacao() {
  const { empresaId, loading: empresaLoading } = useEmpresa()
  const [periodo, setPeriodo] = useState<string | undefined>(undefined)
  const { data, loading, error, isAuthError, reload } = useContaiQuery(
    () => contaiApi.getConciliacao(empresaId ?? undefined, periodo),
    [empresaId, periodo],
  )

  const report = (data?.report ?? null) as ReportShape | null
  const periodos = data?.periodos ?? []
  const periodoAtivo = periodo ?? data?.periodo_ativo ?? null

  // TODO: ContAI upload endpoints not yet stateless-JWT-clean, verify against
  // ContAI_PRO before wiring in production — confirmar lançamento, marcar
  // exceção, "confirmar todos" e classificação automática por IA
  // (conciliacao.resolver / .excecao / .confirmar-todos / .auto-classificar
  // no Flask original) são todos POST e não estão entre os 7 endpoints GET
  // portados para JSON+Bearer. Os botões abaixo existem como shell de UI.
  function actionNotPorted() {
    alert('Esta ação ainda depende de um endpoint que não foi portado para a API JSON+Bearer (ver TODO no código-fonte).')
  }

  if (empresaLoading || loading) return <ContaiLoading label="Carregando conciliação..." />
  if (error) return <ContaiError message={error} isAuthError={isAuthError} onRetry={reload} />

  return (
    <div>
      <div className="contai-header">
        <div>
          <h1>Conciliação Bancária</h1>
          {report && periodoAtivo && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={14} /> Competência: <strong style={{ color: 'var(--contai-gold)' }}>{periodoAtivo}</strong>
            </p>
          )}
        </div>
        {report && periodos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--contai-text-muted)' }}>Mudar Período:</label>
            <select value={periodoAtivo ?? ''} onChange={(e) => setPeriodo(e.target.value)}>
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {report ? (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            <div className="contai-card" style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: '1.7rem', fontWeight: 700 }}>{report.total_lancamentos ?? 0}</div>
              <div className="contai-kpi-label" style={{ marginTop: 4 }}>Lançamentos Bancários</div>
            </div>
            <div className="contai-card" style={{ flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--contai-green)' }}>{report.conciliados ?? 0}</div>
                <CheckCircle size={16} color="var(--contai-green)" />
              </div>
              <div className="contai-kpi-label" style={{ marginTop: 4 }}>Conciliados</div>
            </div>
            <div className="contai-card" style={{ flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--contai-red)' }}>{report.excecoes ?? 0}</div>
                <AlertCircle size={16} color="var(--contai-red)" />
              </div>
              <div className="contai-kpi-label" style={{ marginTop: 4 }}>Exceções</div>
            </div>
            <div className="contai-card" style={{ flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--contai-gold)' }}>{report.taxa_conciliacao ?? 0}%</div>
                <Percent size={16} color="var(--contai-gold)" />
              </div>
              <div className="contai-kpi-label" style={{ marginTop: 4 }}>Taxa</div>
            </div>
            <div className="contai-card" style={{ flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>R$ {formatBRL(report.valor_total_ofx)}</div>
                <DollarSign size={16} color="var(--contai-text-muted)" />
              </div>
              <div className="contai-kpi-label" style={{ marginTop: 4 }}>Total Bancário</div>
            </div>
            <div className="contai-card" style={{ flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--contai-red)' }}>R$ {formatBRL(report.valor_pendente)}</div>
                <Clock size={16} color="var(--contai-red)" />
              </div>
              <div className="contai-kpi-label" style={{ marginTop: 4 }}>Pendente</div>
            </div>
          </div>

          <div className="contai-card" style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--contai-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Cruzamento Banco/Planilha × PDFs/Docs <span style={{ color: 'var(--contai-gold)' }}>({report.detalhes?.length ?? 0})</span>
              </h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {(report.conciliados ?? 0) > 0 && (
                  <button type="button" className="contai-btn-outline" onClick={actionNotPorted}>
                    Confirmar {report.conciliados} conciliados
                  </button>
                )}
                <button type="button" className="contai-btn-gold" onClick={actionNotPorted}>
                  <Zap size={14} /> Classificar Lançamentos
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="contai-table">
                <thead>
                  <tr>
                    <th>Planilha/Extrato (Banco)</th>
                    <th>Comprovante correspondente</th>
                    <th style={{ textAlign: 'center' }}>Score</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.detalhes ?? []).map((m) => {
                    const scorePct = Math.round((m.score ?? 0) * 100)
                    const l = m.lancamento_ofx
                    const d = m.lancamento_pdf
                    return (
                      <tr key={m.lancamento_id}>
                        <td>
                          <span style={{ display: 'block', fontWeight: 500 }}>{l?.historico ?? '—'}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--contai-text-muted)' }}>
                            {l?.data_lancamento ?? ''} •{' '}
                            <span style={{ color: l?.tipo_dc === 'credito' ? 'var(--contai-green)' : 'var(--contai-red)' }}>
                              {l?.tipo_dc === 'credito' ? '+' : '-'}R$ {formatBRL(l?.valor)}
                            </span>
                          </span>
                        </td>
                        <td>
                          {d ? (
                            <>
                              <span style={{ display: 'block', fontWeight: 500 }}>{d.historico ?? '—'}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--contai-text-muted)' }}>
                                {d.data_lancamento ?? ''} •{' '}
                                <span style={{ color: d.tipo_dc === 'credito' ? 'var(--contai-green)' : 'var(--contai-red)' }}>
                                  {d.tipo_dc === 'credito' ? '+' : '-'}R$ {formatBRL(d.valor)}
                                </span>
                              </span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--contai-red)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                              ⚠ Sem comprovante correspondente
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {d ? (
                            <span
                              style={{
                                fontWeight: 700,
                                color: scorePct >= 85 ? 'var(--contai-green)' : scorePct >= 70 ? 'var(--contai-gold)' : 'var(--contai-red)',
                              }}
                            >
                              {scorePct}%
                            </span>
                          ) : (
                            <span style={{ color: '#555' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`contai-tag ${m.status === 'conciliado' ? 'contai-tag-green' : 'contai-tag-red'}`}>
                            {m.status === 'conciliado' ? 'Conciliado' : 'Exceção'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                            <button type="button" className="contai-btn-outline" style={{ padding: '6px 14px' }} onClick={actionNotPorted}>
                              ✓ Confirmar
                            </button>
                            <button type="button" className="contai-btn-outline" style={{ padding: '6px 14px', borderColor: 'var(--contai-red)', color: 'var(--contai-red)' }} onClick={actionNotPorted}>
                              ✕ Exceção
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="contai-card" style={{ textAlign: 'center', padding: '64px 32px', marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>Nenhum cruzamento disponível</h2>
          <p style={{ color: 'var(--contai-text-muted)', fontSize: '0.88rem', maxWidth: 400, margin: '0 auto' }}>
            Para iniciar a conciliação, importe um extrato OFX e um extrato PDF para a mesma empresa. O sistema cruzará os
            lançamentos automaticamente.
          </p>
        </div>
      )}

      {data && data.pendentes.length > 0 && (
        <div className="contai-card">
          <h3 style={{ fontSize: '1rem', marginBottom: 20, color: 'var(--contai-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Registros Financeiros (Base) Importados <span style={{ color: 'var(--contai-gold)' }}>({data.pendentes.length})</span>
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="contai-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Histórico</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {data.pendentes.map((l) => (
                  <tr key={l.id}>
                    <td style={{ color: 'var(--contai-text-muted)' }}>{l.data_lancamento ?? '—'}</td>
                    <td>{l.historico ?? '—'}</td>
                    <td style={{ textAlign: 'right', color: l.tipo_dc === 'credito' ? 'var(--contai-green)' : 'var(--contai-red)' }}>
                      {l.tipo_dc === 'credito' ? '+' : '-'}
                      {formatBRL(l.valor)}
                    </td>
                    <td>
                      <span className="contai-tag contai-tag-gold">{l.origem ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
