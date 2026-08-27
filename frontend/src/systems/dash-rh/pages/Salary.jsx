import GlassCard from '../components/ui/GlassCard';
import BarChart from '../components/charts/BarChart';
import Loader from '../components/ui/Loader';
import { COLORS } from '../utils/colors';
import { formatBRL } from '../utils/formatters';

/**
 * Tab 3: Salary Intelligence
 */
export default function Salary({ data, loading }) {
  if (loading || !data) return <Loader size="lg" text="Carregando inteligência salarial..." />;

  const getBandLabel = (band) => {
    switch (band) {
      case 'Junior': return 'Junior (Até R$ 1,6k)';
      case 'Pleno': return 'Pleno (R$ 1,6k a R$ 2,6k)';
      case 'Senior': return 'Senior (R$ 2,6k a R$ 4k)';
      case 'Especialista': return 'Especialista (> R$ 4k)';
      default: return band;
    }
  };

  // Salary distribution by band
  const distData = (data.by_band || []).map(b => ({
    name: getBandLabel(b.band),
    quantidade: b.total,
  }));

  // Salary by expectation — API returns [{expectation, count, avg_salary, median_salary}]
  const byExpectation = (data.by_expectation || []).map(e => ({
    name: `Expectativa ${e.expectation}`,
    'Salário Médio': e.avg_salary || 0,
  }));

  // Role salary ranking
  const byRole = (data.by_role || [])
    .sort((a, b) => (b.avg_salary || 0) - (a.avg_salary || 0))
    .map(r => ({
      name: r.role,
      salário_médio: r.avg_salary || r.avg || 0,
    }));

  return (
    <div className="page animate-fade-in">
      <section className="page__section">
        <div className="grid grid-2 gap-lg">
          <GlassCard className="animate-slide-up delay-1" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
              Distribuição por Faixa Salarial
            </h3>
            <BarChart
              data={distData}
              xKey="name"
              bars={[
                { 
                  key: 'quantidade', 
                  name: 'Funcionários', 
                  color: COLORS.gold,
                  labelColor: 'var(--bg-app)'
                }
              ]}
              height={300}
              showLegend={false}
            />
          </GlassCard>

          <GlassCard className="animate-slide-up delay-2" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
              Salário por Expectativa
            </h3>
            <BarChart
              data={byExpectation}
              xKey="name"
              bars={[
                { 
                  key: 'Salário Médio', 
                  name: 'Salário Médio', 
                  color: COLORS.gold,
                  labelPosition: 'top',
                  labelColor: 'var(--gold)',
                  labelFormatter: (val) => formatBRL(val)
                },
              ]}
              height={300}
              tooltipFormatter={(value) => formatBRL(value)}
            />
          </GlassCard>
        </div>
      </section>

      <section className="page__section">
        <GlassCard className="animate-slide-up delay-3" style={{ padding: 'var(--space-lg)' }}>
          <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
            Ranking Salarial por Cargo
          </h3>
          <BarChart
            data={byRole}
            xKey="name"
            bars={[
              { 
                key: 'salário_médio', 
                name: 'Salário Médio', 
                color: COLORS.goldLight,
                labelPosition: 'right',
                labelColor: 'var(--gold)',
                labelFormatter: (val) => formatBRL(val)
              }
            ]}
            horizontal
            height={Math.max(300, byRole.length * 40)}
            showLegend={false}
            tooltipFormatter={(value) => formatBRL(value)}
          />
        </GlassCard>
      </section>

      {/* Compensation Friction */}
      {data.compensation_friction?.length > 0 && (
        <section className="page__section">
          <GlassCard className="animate-slide-up delay-4" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
              Mapa de Fricção Salarial
            </h3>
            <p className="text-secondary" style={{ fontSize: '0.8125rem', marginBottom: 'var(--space-md)' }}>
              Cargos com sinais de fricção entre remuneração e confiança
            </p>
            <div className="risk-grid">
              {data.compensation_friction.map((item, i) => (
                <GlassCard key={i} hoverable style={{ padding: 'var(--space-md)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.role}</div>
                  <div className="font-mono" style={{
                    fontSize: '1.5rem', fontWeight: 700,
                    color: item.confidence_pct >= 60 ? COLORS.positive : COLORS.negative,
                  }}>
                    {formatBRL(item.avg_salary)}
                  </div>
                  <div className="text-secondary" style={{ fontSize: '0.8125rem', marginTop: 4 }}>
                    Confiança: {item.confidence_pct?.toFixed(1)}% · {item.count} func.
                  </div>
                </GlassCard>
              ))}
            </div>
          </GlassCard>
        </section>
      )}
    </div>
  );
}
