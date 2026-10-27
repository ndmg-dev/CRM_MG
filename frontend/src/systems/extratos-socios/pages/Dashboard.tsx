import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Building2, TrendingUp, CheckCheck, AlertTriangle, ChevronRight, Search, Inbox } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { extratosApi, extratosQueryOptions } from '../lib/api'
import { fmtBRLCompact, fmtCNPJ, MESES_CURTOS, MESES_LONGOS, mesesEsperados } from '../lib/format'
import { Card, Kpi, Loading, ErrorMsg, EmptyState, Skeleton } from '../components/ui'

const ANO_ATUAL = new Date().getFullYear()
const ANOS = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2]

const DONE = 'oklch(0.72 0.15 150)'
const MISS_BG = 'oklch(0.22 0.009 70 / 0.45)'
const MISS_BD = 'oklch(0.275 0.009 70)'
const FUT_BG = 'oklch(0.19 0.01 70 / 0.4)'
const FUT_BD = 'oklch(0.23 0.009 70)'

function MesesBar({ meses, ano }: { meses: number[]; ano: number }) {
  const set = new Set(meses)
  const mesCorrente = ANO_ATUAL === ano ? new Date().getMonth() + 1 : 12
  return (
    <div className="ex-bar" title={`${meses.length} de 12 meses processados`}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const on = set.has(m)
        const futuro = ano === ANO_ATUAL && m > mesCorrente && !on
        const style = on
          ? { background: DONE, borderColor: DONE }
          : futuro
            ? { background: FUT_BG, borderColor: FUT_BD }
            : { background: MISS_BG, borderColor: MISS_BD }
        return <span key={m} className="ex-bar-seg" style={style} title={MESES_CURTOS[m - 1]} />
      })}
    </div>
  )
}

function badgeTone(done: number, rel: number): 'done' | 'partial' | 'error' {
  if (done >= rel) return 'done'
  if (done >= rel - 3) return 'partial'
  return 'error'
}

export default function Dashboard() {
  const [ano, setAno] = useState(ANO_ATUAL)
  const [filtro, setFiltro] = useState('')
  const navigate = useNavigate()
  const toAbs = useNativeSystemPath()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['extratos', 'dashboard', ano],
    queryFn: () => extratosApi.dashboard(ano),
    ...extratosQueryOptions,
  })

  const rel = mesesEsperados(ano) || 12
  const q = filtro.trim().toLowerCase()
  const empresas = (data?.empresas ?? []).filter(
    (e) => !q || (e.razaoSocial || '').toLowerCase().includes(q) || e.cnpj.includes(q.replace(/\D/g, '')),
  )

  return (
    <div>
      <div className="ex-page-head">
        <div>
          <h2 className="ex-page-title">Extratos de Sócios</h2>
          <p className="ex-page-sub">Consolidado das movimentações dos sócios por empresa — espelho do processamento do n8n.</p>
        </div>
        <select className="ex-select" value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Exercício">
          {ANOS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="ex-kpi-grid">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 118, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <div className="ex-kpi-grid">
          <Kpi icon={Building2} tone="gold" value={data?.empresasComExtrato ?? 0} label="Empresas com extrato" sub={`no exercício ${ano}`} delta={String(ano)} deltaTone="gold" />
          <Kpi icon={TrendingUp} tone="ret" value={fmtBRLCompact(data?.totalRetiradasAno)} label="Retiradas de sócios" sub="no ano" delta="exercício" deltaTone="neutral" />
          <Kpi icon={CheckCheck} tone="apo" value={data?.extratosNoMes ?? 0} label="Extratos processados" sub={`${MESES_LONGOS[new Date().getMonth()]} / ${ANO_ATUAL}`} delta="no mês" deltaTone="apo" />
          <Kpi icon={AlertTriangle} tone="warn" value={data?.pendencias ?? 0} label="Pendências" sub="CNPJ sem cliente" delta={(data?.pendencias ?? 0) > 0 ? 'requer ação' : 'ok'} deltaTone={(data?.pendencias ?? 0) > 0 ? 'warn' : 'apo'} />
        </div>
      )}

      {/* Empresas */}
      <Card
        className="ex-mt"
        title="Empresas"
        sub={data ? `${data.empresas.length} com extrato neste ano` : undefined}
        action={
          data && data.empresas.length > 0 ? (
            <div className="ex-filter">
              <Search size={14} />
              <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar empresas" aria-label="Filtrar empresas" />
            </div>
          ) : undefined
        }
      >
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <ErrorMsg error={error} />
        ) : !data || data.empresas.length === 0 ? (
          <EmptyState icon={Inbox} title={`Nenhum extrato processado em ${ano}`} tone="neutral">
            Assim que o n8n enviar os extratos dos clientes, as empresas e o consolidado dos sócios aparecem aqui.
          </EmptyState>
        ) : empresas.length === 0 ? (
          <div className="ex-state">Nenhuma empresa corresponde a "{filtro}".</div>
        ) : (
          <div className="ex-empresa-list">
            {empresas.map((e) => {
              const done = e.mesesProcessados.length
              const tone = badgeTone(done, rel)
              return (
                <button key={e.clientId} type="button" className="ex-empresa-row" onClick={() => navigate(toAbs(`empresa/${e.clientId}?ano=${ano}`))}>
                  <span className="ex-empresa-chip">
                    <Building2 size={16} />
                  </span>
                  <div className="ex-empresa-ident">
                    <div className="ex-empresa-nome">{e.razaoSocial || '(sem razão social)'}</div>
                    <div className="ex-empresa-cnpj">{fmtCNPJ(e.cnpj)}</div>
                  </div>
                  {e.sociosAcimaLimite > 0 && (
                    <span
                      className="ex-badge-limite"
                      title={`${e.sociosAcimaLimite} sócio(s) acima do limite operacional`}
                    >
                      <AlertTriangle size={13} />
                      {e.sociosAcimaLimite > 1 ? `${e.sociosAcimaLimite} acima do limite` : 'acima do limite'}
                    </span>
                  )}
                  <MesesBar meses={e.mesesProcessados} ano={ano} />
                  <span className={`ex-badge ${tone}`}>
                    {done}/{rel} meses
                  </span>
                  <ChevronRight size={16} className="ex-empresa-chevron" />
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
