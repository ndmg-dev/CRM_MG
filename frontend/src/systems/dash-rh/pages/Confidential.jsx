import { useState, useEffect, useMemo } from 'react';
import { Lock, Search, AlertTriangle, Shield, CheckCircle, Users, DollarSign } from 'react-feather';
import GlassCard from '../components/ui/GlassCard';
import MetricCard from '../components/ui/MetricCard';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import api from '../api/client';
import { formatBRL, formatTenure } from '../utils/formatters';

/**
 * Área Restrita — detalhamento nominal.
 * Migrado do HR-DASH-MG: o gate de senha (X-Confidential-Auth) foi removido.
 * O acesso agora é decidido no backend pela allowlist de e-mails do JWT do
 * CRM: busca direto no mount; 401 => tela "Acesso negado".
 */
export default function Confidential() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // 'denied' | 'generic' | null

  const [search, setSearch] = useState('');
  const [expectationFilter, setExpectationFilter] = useState('all');

  useEffect(() => {
    let active = true;
    api.getConfidential()
      .then((res) => { if (active) { setData(res); setLoading(false); } })
      .catch((err) => {
        if (!active) return;
        setError(err?.status === 401 ? 'denied' : 'generic');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(emp => {
      const matchSearch = emp.func.toLowerCase().includes(search.toLowerCase()) ||
                          emp.cargo.toLowerCase().includes(search.toLowerCase());

      const matchExpectation = expectationFilter === 'all' ? true :
                               expectationFilter === 'positive' ? emp.expectativa === true :
                               emp.expectativa === false;

      return matchSearch && matchExpectation;
    });
  }, [data, search, expectationFilter]);

  if (loading) {
    return <Loader size="lg" text="Carregando detalhamento..." />;
  }

  if (error) {
    const msg = error === 'denied'
      ? 'Acesso negado. Seu usuário não tem permissão para ver o detalhamento nominal. Fale com o RH se precisar de acesso.'
      : 'Erro ao carregar os dados.';
    return (
      <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <GlassCard className="animate-scale-in" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: 'var(--space-2xl) var(--space-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-md)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--gold-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
              <Lock size={32} />
            </div>
          </div>
          <h2 className="heading-lg" style={{ marginBottom: 'var(--space-xs)' }}>Detalhamento</h2>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>{msg}</p>
        </GlassCard>
      </div>
    );
  }

  // --- Authenticated View ---

  const negativeCount = filteredData.filter(e => !e.expectativa).length;
  const avgSalary = filteredData.length > 0
    ? filteredData.reduce((acc, curr) => acc + curr.salario, 0) / filteredData.length
    : 0;

  return (
    <div className="page animate-fade-in">
      <header className="page__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Badge variant="gold"><Shield size={12} style={{ marginRight: '4px' }} /> Confidencial</Badge>
          </div>
          <h1 className="heading-xl">Área Restrita</h1>
          <p className="page__subtitle" style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
            Detalhamento nominal e visualização de dados brutos.
          </p>
        </div>
      </header>

      <section className="page__section">
        <div className="grid grid-3 gap-md">
          <MetricCard
            icon={<Users size={18} />}
            label="Colaboradores Listados"
            value={filteredData.length}
            description="Total de funcionários visíveis no filtro atual."
            delay={1}
          />
          <MetricCard
            icon={<AlertTriangle size={18} />}
            label="Em Risco (Expectativa)"
            value={negativeCount}
            trend={negativeCount > 0 ? 'down' : 'neutral'}
            description="Colaboradores sinalizando expectativa negativa."
            delay={2}
          />
          <MetricCard
            icon={<DollarSign size={18} />}
            label="Salário Médio (Filtro)"
            value={avgSalary}
            prefix="R$ "
            decimals={2}
            description="Média salarial baseada na lista exibida abaixo."
            delay={3}
          />
        </div>
      </section>

      <section className="page__section">
        <GlassCard className="flex-col gap-md animate-slide-up delay-4" style={{ padding: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
            <div style={{ flex: '1', minWidth: '250px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por nome ou cargo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 10px 10px 36px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            <select
              value={expectationFilter}
              onChange={(e) => setExpectationFilter(e.target.value)}
              style={{
                padding: '10px 16px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              <option value="all" style={{ background: '#111', color: '#fff' }}>Todas as Expectativas</option>
              <option value="positive" style={{ background: '#111', color: '#fff' }}>Apenas Positivas</option>
              <option value="negative" style={{ background: '#111', color: '#fff' }}>Apenas Negativas</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Nome / Identificador</th>
                  <th style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cargo</th>
                  <th style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tempo</th>
                  <th style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Salário</th>
                  <th style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center' }}>Expectativa</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhum colaborador encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((emp, idx) => (
                    <tr key={idx} style={{
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px', fontWeight: 500, color: 'white' }}>{emp.func}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{emp.cargo}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{formatTenure(emp.tenure_years)}</td>
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--gold)', textAlign: 'right' }}>
                        {formatBRL(emp.salario)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {emp.expectativa ? (
                          <Badge variant="positive"><CheckCircle size={10} style={{ marginRight: '4px' }}/> Positiva</Badge>
                        ) : (
                          <Badge variant="negative"><AlertTriangle size={10} style={{ marginRight: '4px' }}/> Risco</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
