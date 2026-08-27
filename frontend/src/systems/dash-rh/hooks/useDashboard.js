import api from '../api/client';
import { useApi } from './useApi';

/**
 * Central dashboard data hook.
 * Migrado do HR-DASH-MG: a navegação por tab-state virou rotas reais do
 * React Router (ver DashRhApp.tsx), então este hook não guarda mais
 * activeTab/changeTab — só dispara os 7 fetches e devolve data/loading/errors.
 * O array TABS continua exportado: o Topbar usa `id`/`label`/`icon` + o novo
 * campo `path` (subrota) pra montar os NavLinks.
 *
 * NOTA: os 7 useApi disparam no mount independente da rota atual — mesmo
 * comportamento do satélite (que prefetchava todas as tabs). É aceitável.
 */

const TABS = [
  { id: 'presentation', label: 'Apresentação', icon: 'Monitor', path: '.' },
  { id: 'overview', label: 'Visão Geral', icon: 'BarChart2', path: 'overview' },
  { id: 'benefits', label: 'Benefícios', icon: 'Award', path: 'benefits' },
  { id: 'expectations', label: 'Expectativas', icon: 'Target', path: 'expectations' },
  { id: 'salary', label: 'Salários', icon: 'DollarSign', path: 'salary' },
  { id: 'tenure', label: 'Tempo & Carreira', icon: 'Clock', path: 'tenure' },
  { id: 'roles', label: 'Cargos', icon: 'Users', path: 'roles' },
];

export function useDashboard() {
  const overview = useApi(api.getOverview);
  const benefits = useApi(api.getBenefits);
  const expectations = useApi(api.getExpectations);
  const salary = useApi(api.getSalary);
  const tenure = useApi(api.getTenure);
  const roles = useApi(api.getRoles);
  const presentation = useApi(api.getPresentation);

  const isLoading = overview.loading || benefits.loading || expectations.loading ||
    salary.loading || tenure.loading || roles.loading || presentation.loading;

  const hasError = overview.error || benefits.error || expectations.error ||
    salary.error || tenure.error || roles.error || presentation.error;

  return {
    isLoading,
    hasError,
    data: {
      overview: overview.data,
      benefits: benefits.data,
      expectations: expectations.data,
      salary: salary.data,
      tenure: tenure.data,
      roles: roles.data,
      presentation: presentation.data,
    },
    loading: {
      overview: overview.loading,
      benefits: benefits.loading,
      expectations: expectations.loading,
      salary: salary.loading,
      tenure: tenure.loading,
      roles: roles.loading,
      presentation: presentation.loading,
    },
    errors: {
      overview: overview.error,
      benefits: benefits.error,
      expectations: expectations.error,
      salary: salary.error,
      tenure: tenure.error,
      roles: roles.error,
      presentation: presentation.error,
    },
  };
}

export { TABS };
