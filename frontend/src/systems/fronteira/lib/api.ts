import axios from "axios";

// ============================================================================
// PORT ADAPTADO de tnunes8/sistema-fronteira-v8 (frontend/src/lib/api.ts).
// O ORIGINAL nunca é alterado (repo alheio, sistema sensível — só migração,
// zero mudança de comportamento). A ÚNICA diferença real deste arquivo em
// relação ao original é a `baseURL`: era "/api" (same-origin, proxy de dev
// do Vite ou nginx do próprio v8 em produção); aqui vira o proxy do backend
// do CRM, que reescreve os cookies de sessão pra funcionarem no domínio do
// CRM — ver backend-fastapi/app/api/v1/endpoints/fronteira_proxy.py pro
// motivo completo (a sessão do v8 é 100% cookie httpOnly same-origin, sem
// esse proxy o navegador do CRM nunca conseguiria enviar/receber esses
// cookies do domínio do v8).
//
// Tudo mais — CSRF double-submit, retry de refresh em 401, download de
// blob — é o MESMO código do original, sem nenhuma lógica nova.
// ============================================================================
export const api = axios.create({ baseURL: "/api/v1/fronteira-proxy", withCredentials: true });

declare module "axios" {
  export interface AxiosRequestConfig {
    _retry?: boolean;
    _noRedirect?: boolean;
  }
}

const CSRF_COOKIE = "fronteira_csrf";
const SAFE_METHODS = ["get", "head", "options"];

function getCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Único ponto de verdade pra "voltar ao login" — igual a
// hooks/useNativeSystemBase.ts, mas este arquivo é .ts puro (sem hooks),
// então resolve o :id direto da URL. Nunca redireciona pra raiz do CRM: é
// o login DO SISTEMA (usuário/senha próprios do v8, nada a ver com login
// do CRM), igual ao mg-prospect/lib/api.ts faz pro mesmo problema.
function redirectToLogin() {
  const match = window.location.pathname.match(/^(\/sistemas\/[^/]+)/);
  const loginPath = match ? `${match[1]}/login` : "/login";
  if (!window.location.pathname.startsWith(loginPath)) window.location.href = loginPath;
}

api.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toLowerCase();
  if (!SAFE_METHODS.includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) config.headers.set("X-CSRF-Token", csrf);
  }
  return config;
});

let refreshPromise: Promise<unknown> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url: string = original?.url ?? "";
    const isAuthRoute =
      url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/logout");

    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        if (!refreshPromise) refreshPromise = api.post("/auth/refresh");
        await refreshPromise;
        refreshPromise = null;
        return api(original);
      } catch (refreshError) {
        refreshPromise = null;
        if (!original._noRedirect) redirectToLogin();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

async function triggerBlobDownload(res: { data: unknown; headers: Record<string, unknown> }, fallbackName: string) {
  let filename = fallbackName;
  const cd = res.headers["content-disposition"] as string | undefined;
  if (cd) {
    const utf8 = cd.match(/filename\*=UTF-8''([^;]+)/i);
    const plain = cd.match(/filename="?([^";]+)"?/i);
    if (utf8) filename = decodeURIComponent(utf8[1]);
    else if (plain) filename = plain[1];
  }
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const res = await api.get(url, { responseType: "blob" });
  await triggerBlobDownload(res, fallbackName);
}

export async function downloadFilePost(url: string, body: FormData, fallbackName: string): Promise<void> {
  const res = await api.post(url, body, { responseType: "blob" });
  await triggerBlobDownload(res, fallbackName);
}

export async function downloadFileJsonPost(url: string, body: unknown, fallbackName: string): Promise<void> {
  const res = await api.post(url, body, { responseType: "blob" });
  await triggerBlobDownload(res, fallbackName);
}

export function apiError(error: unknown, fallback = "Ocorreu um erro."): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  }
  return fallback;
}
