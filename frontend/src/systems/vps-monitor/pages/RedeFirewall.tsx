import { useQuery } from '@tanstack/react-query'
import { vpsApi, vpsQueryOptions } from '../lib/api'
import { fmtDateTime } from '../lib/format'
import { Badge, Card, Empty, ErrorMsg, Loading } from '../components/ui'

export default function RedeFirewall() {
  const vmQ = useQuery({ queryKey: ['vps', 'vm'], queryFn: vpsApi.vm, ...vpsQueryOptions })
  const fwQ = useQuery({ queryKey: ['vps', 'firewall'], queryFn: vpsApi.firewall, ...vpsQueryOptions })

  if (vmQ.isLoading || fwQ.isLoading) return <Loading />
  if (vmQ.error) return <ErrorMsg error={vmQ.error} />
  if (fwQ.error) return <ErrorMsg error={fwQ.error} />

  const vm = vmQ.data
  const groups = fwQ.data?.data ?? []
  const activeId = vm?.firewall_group_id ?? null

  return (
    <>
      <h2 className="vm-page-title">Rede &amp; Firewall</h2>
      <p className="vm-page-sub">Somente leitura. Edição de regras entra na Fase 4 (admin-only).</p>

      <div className="vm-grid" style={{ marginBottom: 14 }}>
        <Card title="Rede">
          <dl className="vm-kv">
            <dt>IPv4</dt>
            <dd>{vm?.ipv4?.map((i) => i.address).join(', ') || '—'}</dd>
            <dt>IPv6</dt>
            <dd>{vm?.ipv6?.map((i) => i.address).join(', ') || '—'}</dd>
            <dt>PTR</dt>
            <dd>{vm?.ipv4?.[0]?.ptr ?? '—'}</dd>
            <dt>Nameservers</dt>
            <dd>{[vm?.ns1, vm?.ns2].filter(Boolean).join(', ') || '—'}</dd>
            <dt>Firewall ativo</dt>
            <dd>{activeId ? `grupo #${activeId}` : 'nenhum atrelado à VPS'}</dd>
          </dl>
        </Card>
      </div>

      {groups.length === 0 ? (
        <Empty>Nenhum grupo de firewall cadastrado na conta.</Empty>
      ) : (
        groups.map((g) => (
          <Card key={g.id} title={`Grupo "${g.name}" · #${g.id}`} className="vm-chart-card">
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <Badge tone={g.id === activeId ? 'ok' : 'neutral'}>
                {g.id === activeId ? 'Aplicado nesta VPS' : 'Não aplicado'}
              </Badge>
              <Badge tone={g.is_synced ? 'ok' : 'warn'}>{g.is_synced ? 'Sincronizado' : 'Não sincronizado'}</Badge>
              <span className="vm-metric-label" style={{ alignSelf: 'center' }}>
                atualizado {fmtDateTime(g.updated_at)}
              </span>
            </div>
            <table className="vm-table">
              <thead>
                <tr>
                  <th>Ação</th>
                  <th>Protocolo</th>
                  <th>Porta</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {g.rules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.action}</td>
                    <td>{r.protocol}</td>
                    <td>{r.port}</td>
                    <td>{r.source_detail || r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))
      )}
    </>
  )
}
