import { useMetrics } from '../hooks/useMetrics'
import { useDepartments } from '../contexts/DepartmentContext'
import ThroughputChart from '../components/Dashboard/ThroughputChart'
import CycleTimeChart from '../components/Dashboard/CycleTimeChart'
import LeadTimeCard from '../components/Dashboard/LeadTimeCard'
import BottleneckAlerts from '../components/Dashboard/BottleneckAlerts'
import WeeklyAIReport from '../components/Dashboard/WeeklyAIReport'
import { RefreshCw } from 'lucide-react'

export default function DashboardPage() {
  const { current: department, currentId } = useDepartments()
  const { throughput, cycleTime, leadTime, bottlenecks, loading, refresh } = useMetrics(currentId)

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div
        className="glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: '1px solid var(--color-border)',
          borderRadius: 0,
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', bottom: 0, left: 32, right: 32, height: 1, background: 'linear-gradient(90deg, rgba(212,168,83,0.2), transparent 80%)' }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Dashboard Gerencial</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {department
              ? `Métricas de produtividade do setor ${department.nome}`
              : 'Métricas de produtividade e performance da equipe'}
          </p>
        </div>
        <button className="btn-secondary" onClick={refresh} id="btn-refresh-dashboard">
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* KPI Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <LeadTimeCard
            label="Cycle Time Médio"
            value={cycleTime?.average_days || 0}
            unit="dias"
            subtitle={`${cycleTime?.average_hours || 0}h • ${cycleTime?.total_tickets || 0} tickets`}
            color="var(--color-accent-gold)"
          />
          <LeadTimeCard
            label="Lead Time Médio"
            value={leadTime?.average_days || 0}
            unit="dias"
            subtitle={`${leadTime?.average_hours || 0}h • ${leadTime?.total_tickets || 0} tickets`}
            color="var(--color-info)"
          />
          <LeadTimeCard
            label="Alertas Ativos"
            value={(bottlenecks?.wip_violations?.length || 0) + (bottlenecks?.stalled_tickets?.length || 0)}
            unit=""
            subtitle={`${bottlenecks?.wip_violations?.length || 0} WIP • ${bottlenecks?.stalled_tickets?.length || 0} parados`}
            color={
              (bottlenecks?.wip_violations?.length || 0) + (bottlenecks?.stalled_tickets?.length || 0) > 0
                ? 'var(--color-danger)'
                : 'var(--color-success)'
            }
          />
        </div>

        {/* Charts Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <ThroughputChart data={throughput} />
          <CycleTimeChart data={cycleTime?.details || []} />
        </div>

        {/* Bottlenecks */}
        <div style={{ marginBottom: 24 }}>
          <BottleneckAlerts bottlenecks={bottlenecks} />
        </div>

        {/* AI Report */}
        <WeeklyAIReport />
      </div>
    </div>
  )
}
