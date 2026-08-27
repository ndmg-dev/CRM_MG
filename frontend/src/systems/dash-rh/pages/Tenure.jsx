import GlassCard from '../components/ui/GlassCard';
import BarChart from '../components/charts/BarChart';
import ScatterChart from '../components/charts/ScatterChart';
import Loader from '../components/ui/Loader';
import { COLORS } from '../utils/colors';

/**
 * Tab 4: Tenure & Career Signals
 * API returns: { stats, distribution, by_role, by_expectation, by_band, career_horizon }
 */
export default function Tenure({ data, loading }) {
  if (loading || !data) return <Loader size="lg" text="Carregando sinais de carreira..." />;

  const distData = (data.by_band || []).map(b => ({
    name: b.band,
    quantidade: b.total,
  }));

  // Tenure by expectation (per band)
  const byExpectation = (data.by_band || []).map(b => ({
    name: b.band,
    Positiva: b.positive || 0,
    Negativa: b.negative || 0,
  }));

  // Career Horizon Matrix data
  const matrixData = (data.career_horizon || []).map(e => ({
    tenure: e.tenure_years ?? 0,
    salary: e.salario ?? 0,
    expectation: e.expectativa ?? false,
    role: e.cargo ?? '',
  }));

  return (
    <div className="page animate-fade-in">
      {/* Career Horizon Matrix */}
      {matrixData.length > 0 && (
        <section className="page__section">
          <GlassCard className="animate-slide-up delay-1" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 4 }}>
              Matriz de Horizonte de Carreira
            </h3>
            <p className="text-secondary" style={{ fontSize: '0.8125rem', marginBottom: 'var(--space-md)' }}>
              Cada ponto é um funcionário: eixo X = tempo de empresa, eixo Y = salário, cor = expectativa
            </p>
            <ScatterChart data={matrixData} height={420} />
          </GlassCard>
        </section>
      )}

      <section className="page__section">
        <div className="grid grid-2 gap-lg">
          <GlassCard className="animate-slide-up delay-2" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
              Distribuição por Faixa de Tempo
            </h3>
            <BarChart
              data={distData}
              xKey="name"
              bars={[{ key: 'quantidade', name: 'Funcionários', color: COLORS.silver }]}
              height={300}
              showLegend={false}
              tooltipFormatter={(value) => `${value} funcionário(s)`}
            />
          </GlassCard>

          <GlassCard className="animate-slide-up delay-3" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
              Expectativa por Faixa de Tempo
            </h3>
            <BarChart
              data={byExpectation}
              xKey="name"
              bars={[
                { key: 'Positiva', name: 'Positiva', color: COLORS.positive },
                { key: 'Negativa', name: 'Negativa', color: COLORS.negative },
              ]}
              stacked
              height={300}
              tooltipFormatter={(value) => `${value} funcionário(s)`}
            />
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
