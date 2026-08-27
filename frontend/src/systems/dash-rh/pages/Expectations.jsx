import { useState } from 'react';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';
import { AlertTriangle, Star } from 'react-feather';
import BarChart from '../components/charts/BarChart';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import Loader from '../components/ui/Loader';
import { COLORS } from '../utils/colors';
import { formatPercent, formatBRL, formatTenure } from '../utils/formatters';

/**
 * Tab 2: Expectations Analysis
 * API returns: { by_role, by_salary_band, by_tenure_band, retention_risk, silent_strength }
 */
export default function Expectations({ data, loading }) {
  const [isBlinking, setIsBlinking] = useState(false);

  if (loading || !data) return <Loader size="lg" text="Carregando análise de expectativas..." />;

  const byRole = (data.by_role || []).map(r => ({
    name: r.role,
    Positiva: r.positive,
    Negativa: r.negative,
  }));

  // Compute overall confidence from by_role
  const totalPositive = (data.by_role || []).reduce((acc, r) => acc + (r.positive || 0), 0);
  const totalEmployees = (data.by_role || []).reduce((acc, r) => acc + (r.total || r.positive + r.negative || 0), 0);
  const confidenceIndex = totalEmployees > 0 ? (totalPositive / totalEmployees * 100) : 0;

  return (
    <div className="page animate-fade-in">
      {/* Confidence Gauge + Risk + Strength */}
      <section className="page__section">
        <div className="grid grid-3 gap-lg">
          <GlassCard goldAccent className="confidence-gauge animate-slide-up delay-1">
            <div className={`confidence-gauge__value text-gold ${isBlinking ? 'animate-glow-blink' : ''}`}>
              <AnimatedCounter 
                end={confidenceIndex} 
                decimals={1} 
                suffix="%" 
                duration={1500} 
                onComplete={() => setIsBlinking(true)} 
              />
            </div>
            <div className="confidence-gauge__label">Índice de Confiança</div>
          </GlassCard>

          {/* Retention Risk */}
          <GlassCard className="animate-slide-up delay-2" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="var(--negative)" /> Sinal de Risco de Retenção
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {(data.retention_risk || []).slice(0, 4).map((item, i) => (
                <div key={i} className="risk-card glass-card" style={{ padding: 'var(--space-md)' }}>
                  <div className="risk-card__header">
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {item.role || item.band || item.label || `Grupo ${i + 1}`}
                    </span>
                    <Badge variant="negative">{item.count || item.negative || 0} func.</Badge>
                  </div>
                  <div className="risk-card__detail">
                    {item.avg_salary != null && `Salário: ${formatBRL(item.avg_salary)}`}
                    {item.avg_tenure != null && ` · Tempo: ${formatTenure(item.avg_tenure)}`}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Silent Strength */}
          <GlassCard className="animate-slide-up delay-3" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Star size={20} color="var(--gold)" /> Zonas de Força Silenciosa
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: 'var(--space-md)' }}>
              Cargos com alta confiança apesar de salários menores
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {(data.silent_strength || []).slice(0, 5).map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: 'var(--space-sm) 0',
                  borderBottom: '1px solid var(--glass-border)',
                }}>
                  <span style={{ fontSize: '0.875rem' }}>{item.role}</span>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <Badge variant="positive">
                      {formatPercent(item.confidence_pct ?? item.confidence ?? 0)}
                    </Badge>
                    <Badge variant="gold">
                      {formatBRL(item.avg_salary ?? 0)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Expectation by Role */}
      <section className="page__section">
        <GlassCard className="animate-slide-up delay-4" style={{ padding: 'var(--space-lg)' }}>
          <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
            Expectativa por Cargo
          </h3>
          <BarChart
            data={byRole}
            xKey="name"
            bars={[
              { key: 'Positiva', name: 'Positiva', color: COLORS.positive },
              { key: 'Negativa', name: 'Negativa', color: COLORS.negative },
            ]}
            stacked
            horizontal
            height={600}
            yAxisWidth={250}
            tooltipFormatter={(value) => `${value} funcionário(s)`}
          />
        </GlassCard>
      </section>
    </div>
  );
}
