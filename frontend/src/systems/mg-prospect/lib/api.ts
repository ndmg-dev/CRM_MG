import axios from 'axios';

// A API do MG Prospect AI (FastAPI/React próprio, JWT próprio da tabela
// `users` dele — não é SSO nem Supabase) só libera CORS pro FRONTEND_URL
// original (prospect.nucleodigital.cloud), então não dá pra chamar direto do
// navegador daqui. Por isso todo tráfego passa pelo proxy servidor-a-servidor
// do backend do CRM (backend-fastapi/app/api/v1/endpoints/mgprospect_proxy.py),
// que só exige que o usuário já esteja logado no CRM e repassa o Authorization
// como veio — a autenticação de negócio continua sendo 100% do MG Prospect.
const API_BASE_URL = '/api/v1/mgprospect-proxy';

export const api = axios.create({
    baseURL: API_BASE_URL,
});

// Chave própria (mgprospect_token), não "mg_token" como no repo original —
// "mg_token" já é usada pelo Ponto Admin dentro deste mesmo CRM
// (src/systems/ponto-admin), e os dois sistemas têm autenticação totalmente
// independente. Usar a mesma chave faria os tokens se sobrescreverem
// silenciosamente se um usuário tivesse os dois sistemas abertos.
const TOKEN_KEY = 'mgprospect_token';

// Injeta o token em todas as requisições
api.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Intercepta respostas com erro 401 e desloga o usuário. Este arquivo é um
// módulo .ts puro (não componente React), então não dá pra usar os hooks
// useNativeSystemBase/useNativeSystemPath aqui — extrai o :id da própria
// URL atual pra montar o path absoluto de login DESTE sistema (nunca a raiz
// do CRM, que tem seu próprio login separado).
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            const match = window.location.pathname.match(/^(\/sistemas\/[^/]+)/);
            window.location.href = match ? `${match[1]}/login` : '/login';
        }
        return Promise.reject(error);
    }
);
