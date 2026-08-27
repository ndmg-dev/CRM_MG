/**
 * API client for the HR Analytics Dashboard backend (Dash RH).
 * Wraps fetch calls to the FastAPI server (hospedado à parte) com tratamento
 * de erro. Migrado do repo HR-DASH-MG: agora envia o Bearer JWT do CRM
 * (localStorage 'crm_token') em toda chamada — SSO, mesmo padrão do
 * systems/contai/api/client.ts. O gate de senha da área confidencial foi
 * removido: 401 em /api/confidential/employees agora significa que o e-mail
 * do JWT não está na allowlist do backend.
 */

const API_BASE =
  import.meta.env.VITE_DASHRH_API_URL || 'https://dashrh.nucleodigital.cloud';

if (!import.meta.env.VITE_DASHRH_API_URL) {
  console.warn(
    '[dash-rh] VITE_DASHRH_API_URL não configurada — usando fallback https://dashrh.nucleodigital.cloud'
  );
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Monta os headers padrão, anexando o Bearer token do CRM quando presente. */
function buildHeaders() {
  const headers = { Accept: 'application/json' };
  const token = localStorage.getItem('crm_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Generic GET request to the API.
 * @param {string} endpoint — path like "/api/overview"
 * @returns {Promise<any>} parsed JSON response
 */
async function get(endpoint) {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new ApiError(
      `API request failed: ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  return response.json();
}

/** Dashboard API methods */
const api = {
  getOverview: () => get('/api/overview'),
  getExpectations: () => get('/api/expectations'),
  getSalary: () => get('/api/salary'),
  getTenure: () => get('/api/tenure'),
  getRoles: () => get('/api/roles'),
  getPresentation: async () => {
    const [pres, ben] = await Promise.all([
      get('/api/presentation'),
      get('/api/benefits/presentation-insights')
    ]);
    return { ...pres, benefits_insights: ben };
  },
  getBenefits: async () => {
    const [overview, ranking, matrix] = await Promise.all([
      get('/api/benefits/overview'),
      get('/api/benefits/ranking'),
      get('/api/benefits/matrix')
    ]);
    return { overview, ranking, matrix };
  },

  getConfidential: () =>
    get('/api/confidential/employees').catch((err) => {
      // 401 agora = e-mail do JWT fora da allowlist do backend.
      if (err instanceof ApiError && err.status === 401) {
        throw new ApiError('Acesso negado', 401);
      }
      throw err;
    }),
};

export default api;
export { ApiError };
