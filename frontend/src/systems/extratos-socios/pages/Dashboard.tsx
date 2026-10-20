import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { extratosApi, extratosQueryOptions } from '../lib/api'
import { fmtBRL, fmtCNPJ, MESES_CURTOS } from '../lib/format'
import { Card, Kpi, Loading, ErrorMsg, Empty } from '../components/ui'

const ANO_ATUAL = new Date().getFullYear()
const ANOS = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2]

function MiniMeses({ meses }: { meses: number[] }) {
  const set = new Set(meses)
  return (
    <div className="ex-mini-meses" title={`${meses.length}/12 meses processados`}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
        <span key={m} className={`ex-mini-dot ${set.has(m) ? 'on' : ''}`} aria-label={MESES_CURTOS[m - 1]} />
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [ano, setAno] = useState(ANO_ATUAL)
  const navigate = useNavigate()
  const toAbs = useNativeSystemPath()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['extratos', 'dashboard', ano],
    queryFn: () => extratosApi.dashboard(ano),
    ...extratosQueryOptions,
  })

  return (
    <div>
      <div className="ex-page-head">
        <div>
          <h2 className="ex-page-title">Extratos de Sócios</h2>
          <p className="ex-page-sub">Consolidado das movimentações dos sócios por empresa — espelho do processamento do n8n.</p>
        </div>
        <select className="ex-select" value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
          {ANOS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="ex-kpi-grid">
        <Kpi label="Empresas com extrato no ano" value={isLoading ? '…' : (data?.empresasComExtrato ?? 0)} tone="neutral" />
        <Kpi label="Retiradas dos sócios no ano" value={isLoading ? '…' : fmtBRL(data?.totalRetiradasAno)} tone="ret" />
        <Kpi label="Extratos processados no mês" value={isLoading ? '…' : (data?.extratosNoMes ?? 0)} tone="neutral" />
        <Kpi label="Pendências (não vinculados)" value={isLoading ? '…' : (data?.pendencias ?? 0)} tone="warn" hint="CNPJ sem cliente" />
      </div>

      <Card title="Empresas" className="ex-mt">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <ErrorMsg error={error} />
        ) : !data || data.empresas.length === 0 ? (
          <Empty>Nenhum extrato processado em {ano}.</Empty>
        ) : (
          <div className="ex-empresa-list">
            {data.empresas.map((e) => (
              <button
                key={e.clientId}
                type="button"
                className="ex-empresa-row"
                onClick={() => navigate(toAbs(`empresa/${e.clientId}?ano=${ano}`))}
              >
                <div className="ex-empresa-ident">
                  <div className="ex-empresa-nome">{e.razaoSocial || '(sem razão social)'}</div>
                  <div className="ex-empresa-cnpj">{fmtCNPJ(e.cnpj)}</div>
                </div>
                <MiniMeses meses={e.mesesProcessados} />
                <span className="ex-empresa-count">{e.mesesProcessados.length}/12</span>
                <ChevronRight size={16} className="ex-empresa-chevron" />
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
