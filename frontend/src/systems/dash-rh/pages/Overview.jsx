import { Users, Target, DollarSign, Clock, Zap } from 'react-feather';
import MetricCard from '../components/ui/MetricCard';
import GlassCard from '../components/ui/GlassCard';
import DonutChart from '../components/charts/DonutChart';
import BarChart from '../components/charts/BarChart';
import Loader from '../components/ui/Loader';
import { COLORS } from '../utils/colors';
import { formatBRL, formatPercent, formatTenure } from '../utils/formatters';

/**
 * Tab 1: Executive Overview
 */
export default function Overview({ data, loading }) {
  if (loading || !data) return <Loader size="lg" text="Carregando visão geral..." />;

  const donutData = [
    { name: 'Sim', value: data.expectations.positive },
    { name: 'Não', value: data.expectations.negative },
  ];

  const roleData = (data.top_roles || []).slice(0, 7).map(r => ({
    name: r.role,
    quantidade: r.count,
  }));

  return (
    <div className="page animate-fade-in">
      <section className="page__section">
        <div className="grid grid-4 gap-md">
          <MetricCard
            icon={<Users size={18} />}
            label="Total de Funcionários"
            value={data.total_employees}
            description="Contagem de colaboradores ativos na base de dados."
            delay={1}
          />
          <MetricCard
            icon={<Target size={18} />}
            label="Índice de Confiança"
            value={data.confidence_index}
            suffix="%"
            decimals={1}
            trend={data.confidence_index >= 60 ? 'up' : 'down'}
            trendLabel={data.confidence_index >= 60 ? 'Saudável' : 'Atenção'}
            delay={2}
          />
          <MetricCard
            icon={<DollarSign size={18} />}
            label="Salário Médio"
            value={data.salary.avg}
            prefix="R$ "
            decimals={2}
            description="Média calculada sobre toda a folha de pagamento."
            delay={3}
          />
          <MetricCard
            icon={<Clock size={18} />}
            label="Tempo Médio"
            value={data.tenure.avg}
            suffix=" anos"
            decimals={1}
            description="Duração média do vínculo empregatício."
            delay={4}
          />
        </div>
      </section>

      <section className="page__section">
        <div className="grid grid-2 gap-lg">
          <GlassCard className="animate-slide-up delay-3" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
              Expectativa para 5 Anos
            </h3>
            <DonutChart
              data={donutData}
              colors={[COLORS.positive, COLORS.negative]}
              height={340}
              centerLabel={
                <div>
                  <div className="metric-value text-gold">
                    {formatPercent(data.confidence_index)}
                  </div>
                  <div className="metric-label" style={{ marginTop: 4 }}>positiva</div>
                </div>
              }
            />
          </GlassCard>

          <GlassCard className="animate-slide-up delay-4" style={{ padding: 'var(--space-lg)' }}>
            <h3 className="heading-md" style={{ marginBottom: 'var(--space-md)' }}>
              Principais Cargos
            </h3>
            <BarChart
              data={roleData}
              xKey="name"
              bars={[{ key: 'quantidade', name: 'Funcionários', color: COLORS.gold, labelColor: '#111111' }]}
              height={340}
              horizontal
              showGrid={false}
              showLegend={false}
              tooltipFormatter={(value) => `${value} funcionário(s)`}
            />
          </GlassCard>
        </div>
      </section>

      <section className="page__section">
        <GlassCard goldAccent className="story-card animate-slide-up delay-5" style={{ padding: 'var(--space-xl)' }}>
          <div className="story-card__icon">
            <Zap size={24} />
          </div>
          <div className="story-card__content">
            <h3 className="heading-md text-gold">Insight Executivo</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-sm)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-primary)' }}>
                {formatPercent(data.confidence_index)}
              </strong>{' '}
              dos {data.total_employees} funcionários se veem na empresa nos próximos 5 anos.
              O salário médio é de{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{formatBRL(data.salary.avg)}</strong>,
              com variação de {formatBRL(data.salary.min)} a {formatBRL(data.salary.max)}.
              O tempo médio de casa é de{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{formatTenure(data.tenure.avg)}</strong>.
            </p>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
