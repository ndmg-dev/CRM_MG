import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertOctagon, AlertTriangle, Check, CheckCircle2, Info, RefreshCw } from 'lucide-react'
import { vpsApi, vpsQueryOptions } from '../lib/api'
import type { Insight } from '../lib/types'
import { fmtRelative } from '../lib/format'
import { Empty, ErrorMsg, Freshness, Loading, SeverityPills } from '../components/ui'

function icon(sev: Insight['severity']) {
  if (sev === 'critical') return <AlertOctagon size={18} />
  if (sev === 'warning') return <AlertTriangle size={18} />
  return <Info size={18} />
}

export default function Insights() {
  const qc = useQueryClient()
  const { data, isLoading, error, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['vps', 'insights'],
    queryFn: vpsApi.insights,
    refetchInterval: 90_000,
    ...vpsQueryOptions,
  })

  const ack = useMutation({
    mutationFn: (key: string) => vpsApi.ackInsight(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vps', 'insights'] }),
  })

  const persisted = data?.insights.some((i) => i.status)

  return (
    <>
      <div className="vm-toolbar">
        <h2 className="vm-page-title">Insights</h2>
        <SeverityPills counts={data?.counts} />
        <button className="vm-btn" style={{ marginLeft: 'auto' }} onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? 'vm-inline-spin' : undefined} /> Atualizar
        </button>
        <Freshness updatedAt={dataUpdatedAt} fetching={isFetching && !isLoading} />
      </div>
      <p className="vm-page-sub">
        Regras determinísticas sobre a janela de 30 dias da Hostinger.{' '}
        {persisted
          ? 'O poller registra cada alerta e notifica o TI nos críticos.'
          : 'O poller (Fase 3) ainda não acumulou eventos — os alertas abaixo são calculados ao vivo.'}
      </p>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorMsg error={error} />
      ) : !data || data.insights.length === 0 ? (
        <Empty>
          <CheckCircle2 size={22} style={{ display: 'inline', color: 'var(--vm-ok)' }} />
          <div style={{ marginTop: 8 }}>Nenhum alerta aberto. Disco, RAM, CPU, backups e Monarx dentro do esperado.</div>
        </Empty>
      ) : (
        data.insights.map((i) => (
          <div key={i.id} className={`vm-insight ${i.severity}`} style={i.status === 'reconhecido' ? { opacity: 0.6 } : undefined}>
            <span className="icon">{icon(i.severity)}</span>
            <div className="body">
              <div className="title">{i.title}</div>
              <div className="detail">{i.detail}</div>
              {i.since && (
                <div className="detail" style={{ marginTop: 2 }}>
                  aberto {fmtRelative(i.since)}
                  {i.status === 'reconhecido' && ' · reconhecido'}
                </div>
              )}
            </div>
            {i.value && <span className="value">{i.value}</span>}
            {i.status === 'aberto' && (
              <button
                className="vm-btn"
                style={{ alignSelf: 'center' }}
                onClick={() => ack.mutate(i.id)}
                disabled={ack.isPending}
                title="Reconhecer (não é ação na VPS — só marca que o TI viu)"
              >
                <Check size={13} /> Reconhecer
              </button>
            )}
          </div>
        ))
      )}
    </>
  )
}
