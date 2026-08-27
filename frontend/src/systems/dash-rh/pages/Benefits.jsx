import React from 'react';
import MetricCard from '../components/ui/MetricCard';
import BarChart from '../components/charts/BarChart';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import { Award, Globe, Target, AlertTriangle } from 'react-feather';

export default function Benefits({ data, loading }) {
  if (loading || !data) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader size="large" />
      </div>
    );
  }

  const { overview, ranking, matrix } = data;

  // Transform ranking data for BarChart
  const rankingData = ranking.ranking.map(c => ({
    name: c.empresa,
    score: c.score,
    is_mg: c.is_mg
  }));

  return (
    <div className="page animate-fade-in">
      <section className="page__section">
        <header className="page-header slide-down">
          <div>
            <h1 className="page-title">Benchmark de Benefícios</h1>
            <p className="page-subtitle">
              Comparativo competitivo dos benefícios oferecidos frente ao mercado.
            </p>
          </div>
        </header>
      </section>

      {/* KPI Cards */}
      <section className="page__section">
        <div className="grid grid-4 gap-md">
          <MetricCard
            label="Mendonça Galvão"
            value={overview.mg_score}
            suffix="%"
            icon={<Award size={18} />}
            delay={1}
            description="Índice de adoção de benefícios da Mendonça Galvão."
            className="animate-slide-up delay-1"
          />
          <MetricCard
            label="Média de Mercado"
            value={overview.market_avg_score}
            suffix="%"
            icon={<Globe size={18} />}
            delay={2}
            description="Média de adoção entre as empresas concorrentes."
            className="animate-slide-up delay-2"
          />
          <MetricCard
            label="Gaps Competitivos"
            value={overview.gap_count}
            icon={<Target size={18} />}
            delay={3}
            trend={overview.gap_count > 0 ? "down" : "neutral"}
            trendLabel={overview.gap_count > 0 ? "Atenção necessária" : "Alinhado"}
            description="Benefícios onde a empresa está abaixo do mercado."
            className="animate-slide-up delay-3"
          />
          <MetricCard
            label="Oportunidades Críticas"
            value={overview.high_impact_opportunities}
            icon={<AlertTriangle size={18} />}
            delay={4}
            trend={overview.high_impact_opportunities > 0 ? "down" : "neutral"}
            trendLabel="Alto impacto"
            description="Gaps em benefícios de alto impacto na atração."
            className="animate-slide-up delay-4"
          />
        </div>
      </section>

      <section className="page__section">
        <div className="grid grid-2 gap-lg">
          {/* Ranking */}
          <GlassCard className="animate-slide-up delay-5" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
              Ranking de Cobertura de Benefícios
            </h3>
            <BarChart 
              data={rankingData} 
              xKey="name" 
              bars={[{ key: 'score', color: 'var(--gold)', name: 'Score' }]} 
              horizontal={true}
              height={340}
              showLegend={false}
            />
          </GlassCard>

          {/* Category breakdown */}
          <GlassCard className="animate-slide-up delay-6" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
              Cobertura por Categoria
            </h3>
            <BarChart 
              data={matrix.categories} 
              xKey="categoria_beneficio" 
              bars={[
                { key: 'mg_score', color: 'var(--gold)', name: 'Mendonça Galvão' },
                { key: 'market_score', color: 'var(--silver-dark)', name: 'Média Mercado' }
              ]} 
              horizontal={true}
              height={340}
              showLegend={true}
            />
          </GlassCard>
        </div>
      </section>

      {/* Gap Matrix */}
      <section className="page__section">
        <div className="animate-slide-up delay-7">
          <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
            Matriz de Oportunidades e Gaps
          </h3>
          
          <GlassCard style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)', fontWeight: 500 }}>Benefício</th>
                  <th style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)', fontWeight: 500 }}>Categoria</th>
                  <th style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)', fontWeight: 500 }}>MG Status</th>
                  <th style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)', fontWeight: 500 }}>Adoção Mercado</th>
                  <th style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)', fontWeight: 500 }}>Impacto</th>
                  <th style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)', fontWeight: 500 }}>Recomendação</th>
                </tr>
              </thead>
              <tbody>
                {matrix.gaps.map((gap, i) => {
                  let mgVariant = 'neutral';
                  if (gap.mg_status === 'Oferece') mgVariant = 'positive';
                  else if (gap.mg_status === 'Não oferece') mgVariant = 'negative';
                  else if (gap.mg_status === 'Parcial/Subsidiado') mgVariant = 'warning';

                  let impactVariant = 'neutral';
                  if (gap.impacto_atracao === 'Alto') impactVariant = 'gold';
                  
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-border-hover)' }}>
                      <td style={{ padding: 'var(--space-md)', fontWeight: 500 }}>
                        {gap.beneficio}
                        {gap.is_market_standard && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: 4 }}>
                            Padrão de Mercado
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)' }}>{gap.categoria_beneficio}</td>
                      <td style={{ padding: 'var(--space-md)' }}>
                        <Badge variant={mgVariant}>{gap.mg_status}</Badge>
                      </td>
                      <td style={{ padding: 'var(--space-md)' }}>{gap.competitor_adoption_rate}%</td>
                      <td style={{ padding: 'var(--space-md)' }}>
                        <Badge variant={impactVariant}>{gap.impacto_atracao}</Badge>
                      </td>
                      <td style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)' }}>{gap.recommendation}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
