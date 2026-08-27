import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';
import HeatmapChart from '../components/charts/HeatmapChart';
import Loader from '../components/ui/Loader';
import { formatBRL, formatPercent, formatTenure } from '../utils/formatters';

/**
 * Tab 5: Role Segmentation
 * API returns: { summary: [...], sentiment_heatmap: [...] }
 */
export default function Roles({ data, loading }) {
  if (loading || !data) return <Loader size="lg" text="Carregando segmentação por cargo..." />;

  const roles = data.summary || data.roles || [];

  const heatmapColumns = [
    { key: 'count', label: 'Qtd' },
    { key: 'avg_salary', label: 'Salário Médio', format: v => formatBRL(v) },
    { key: 'avg_tenure', label: 'Tempo Médio', format: v => formatTenure(v) },
    { key: 'confidence_pct', label: 'Confiança', format: v => formatPercent(v) },
  ];

  return (
    <div className="page animate-fade-in">
      {/* Heatmap Table */}
      <section className="page__section">
        <GlassCard className="animate-slide-up delay-1" style={{ padding: 'var(--space-lg)' }}>
          <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
            Mapa de Sentimento por Cargo
          </h3>
          <HeatmapChart
            data={roles}
            columns={heatmapColumns}
            rowKey="role"
            heatKey="confidence_pct"
          />
        </GlassCard>
      </section>

      {/* Role Cards */}
      <section className="page__section">
        <h2 className="section-title">Detalhamento por Cargo</h2>
        <div className="risk-grid">
          {roles.map((role, i) => {
            const confidence = role.confidence_pct ?? role.confidence ?? 0;
            return (
              <GlassCard
                key={i}
                hoverable
                className={`animate-slide-up delay-${Math.min(i + 1, 6)}`}
                style={{ padding: 'var(--space-lg)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                  <h4 style={{ fontWeight: 600, fontSize: '0.9375rem', maxWidth: '70%' }}>
                    {role.role}
                  </h4>
                  <Badge variant={confidence >= 60 ? 'positive' : confidence >= 40 ? 'warning' : 'negative'}>
                    {formatPercent(confidence)}
                  </Badge>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                  <div>
                    <div className="metric-label">Funcionários</div>
                    <div className="font-mono" style={{ fontSize: '1.125rem', fontWeight: 600 }}>{role.count}</div>
                  </div>
                  <div>
                    <div className="metric-label">Salário Médio</div>
                    <div className="font-mono" style={{ fontSize: '1.125rem', fontWeight: 600 }}>{formatBRL(role.avg_salary)}</div>
                  </div>
                  <div>
                    <div className="metric-label">Tempo Médio</div>
                    <div className="font-mono" style={{ fontSize: '1.125rem', fontWeight: 600 }}>{formatTenure(role.avg_tenure)}</div>
                  </div>
                  <div>
                    <div className="metric-label">Positiva / Negativa</div>
                    <div style={{ fontSize: '0.875rem' }}>
                      <span className="text-positive">{role.positive || 0}</span>
                      {' / '}
                      <span className="text-negative">{role.negative || 0}</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
