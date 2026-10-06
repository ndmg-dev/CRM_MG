// Cliente HTTP da integração Processar Ponto -> Domínio Folha. Fala com o
// backend do próprio CRM (app/api/v1/endpoints/dominio.py), mesmo JWT
// crm_token do resto do app — diferente de @ponto/api/client.ts, que fala
// com o backend externo do Processar Ponto (processarponto.mendoncagalvao.com.br).
// Mesmo padrão de src/systems/mg-chamados/lib/api.ts.

const API_ROOT = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const BASE = `${API_ROOT}/dominio`;

const snakeToCamel = (str: string) => str.replace(/([-_][a-z0-9])/gi, ($1) => $1.toUpperCase().replace("-", "").replace("_", ""));
const camelToSnake = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

type Json = string | number | boolean | null | undefined | Json[] | { [key: string]: Json };

function toCamel(obj: Json): Json {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  return Object.keys(obj).reduce((acc: { [key: string]: Json }, key) => {
    acc[snakeToCamel(key)] = toCamel((obj as { [key: string]: Json })[key]);
    return acc;
  }, {});
}

function toSnake(obj: Json): Json {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(toSnake);
  return Object.keys(obj).reduce((acc: { [key: string]: Json }, key) => {
    acc[camelToSnake(key)] = toSnake((obj as { [key: string]: Json })[key]);
    return acc;
  }, {});
}

export class DominioApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "DominioApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(base: string, path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("crm_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const body = options.body && typeof options.body === "string" ? JSON.stringify(toSnake(JSON.parse(options.body))) : options.body;

  const res = await fetch(`${base}${path}`, { ...options, headers, body, cache: "no-store" });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const detail = errBody.detail;
    if (detail && typeof detail === "object") {
      throw new DominioApiError(detail.message || `Erro ${res.status}`, res.status, detail.code);
    }
    throw new DominioApiError(detail || `Erro ${res.status}`, res.status);
  }
  if (res.status === 204) return {} as T;
  return toCamel(await res.json()) as T;
}

const req = <T,>(path: string, options?: RequestInit) => request<T>(BASE, path, options);
const reqRoot = <T,>(path: string, options?: RequestInit) => request<T>(API_ROOT, path, options);

// --- Tipos ------------------------------------------------------------

export interface DominioIntegration {
  clienteId: string;
  accountingOfficeName?: string | null;
  clientName?: string | null;
  clientDocument?: string | null;
  hoursFormat?: "HOURS_MINUTES" | "DECIMAL_HOURS" | null;
  enabled: boolean;
  validatedAt?: string | null;
  activatedAt?: string | null;
}

export interface RubricMapping {
  id: string;
  internalEventType: string;
  payslipItemCode: number;
  unit: "HOURS" | "DAYS" | "VALUE" | "PERCENTAGE";
  description?: string | null;
  enabled: boolean;
}

export interface EmployeeProfile {
  employeeId: string;
  cpfMasked?: string | null;
  esocialCategoryCode?: number | null;
  admissionDate?: string | null;
  esocialCode?: string | null;
  enabled: boolean;
}

export interface PayrollEvent {
  employeeId: string;
  employeeCpf: string;
  competence: string; // yyyy-mm-dd
  eventType: string;
  amountMinutes?: number | null;
  amountDays?: number | null;
  amountValue?: number | null;
  missedDays?: string[];
}

export interface ExportItem {
  id: string;
  employeeId: string;
  cpfMasked?: string | null;
  internalEventType: string;
  payslipItemCode: number;
  reference: string;
  operationType: string;
  status: "PENDING" | "SENDING" | "SUCCESS" | "FAILED";
  errorCode?: string | null;
  errorMessage?: string | null;
  attemptCount: number;
}

export interface DominioExport {
  id: string;
  clienteId: string;
  competence: string;
  status: "DRAFT" | "VALIDATING" | "READY" | "SENDING" | "PARTIAL" | "SUCCESS" | "FAILED" | "CANCELLED";
  totalItems: number;
  successItems: number;
  failedItems: number;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  items: ExportItem[];
}

export interface ClienteResumo {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
}

// --- Clientes (reaproveita o CRUD já existente do CRM) ----------------

export const clientesApi = {
  list: (search?: string) =>
    reqRoot<{ content: ClienteResumo[] }>(`/clientes?size=100${search ? `&search=${encodeURIComponent(search)}` : ""}`),
};

// --- Integração ---------------------------------------------------------

export const dominioIntegrationApi = {
  get: (clienteId: string) => req<DominioIntegration>(`/clientes/${clienteId}/integracao`),
  validateActivationKey: (clienteId: string, activationKey: string) =>
    req<DominioIntegration>(`/clientes/${clienteId}/integracao/validar-chave`, {
      method: "POST",
      body: JSON.stringify({ activationKey }),
    }),
  enable: (clienteId: string) => req<DominioIntegration>(`/clientes/${clienteId}/integracao/ativar`, { method: "POST" }),
  disable: (clienteId: string) => req(`/clientes/${clienteId}/integracao`, { method: "DELETE" }),
  setHoursFormat: (clienteId: string, hoursFormat: string) =>
    req<DominioIntegration>(`/clientes/${clienteId}/integracao/formato-horas`, {
      method: "PUT",
      body: JSON.stringify({ hoursFormat }),
    }),
};

// --- Rubricas -------------------------------------------------------------

export const dominioRubricsApi = {
  list: (clienteId: string) => req<RubricMapping[]>(`/clientes/${clienteId}/rubricas`),
  upsert: (clienteId: string, data: Omit<RubricMapping, "id">) =>
    req<RubricMapping>(`/clientes/${clienteId}/rubricas`, { method: "PUT", body: JSON.stringify(data) }),
};

// --- Perfil do colaborador --------------------------------------------------

export const dominioEmployeeApi = {
  get: (clienteId: string, employeeId: string) =>
    req<EmployeeProfile>(`/clientes/${clienteId}/colaboradores/${encodeURIComponent(employeeId)}`),
  upsert: (
    clienteId: string,
    data: { employeeId: string; cpf?: string; esocialCategoryCode?: number; admissionDate?: string; esocialCode?: string }
  ) => req<EmployeeProfile>(`/clientes/${clienteId}/colaboradores`, { method: "PUT", body: JSON.stringify(data) }),
};

// --- Exports ---------------------------------------------------------------

export const dominioExportsApi = {
  create: (clienteId: string, competence: string) =>
    req<DominioExport>(`/clientes/${clienteId}/exports`, { method: "POST", body: JSON.stringify({ competence }) }),
  preview: (exportId: string, competence: string, events: PayrollEvent[]) =>
    req<DominioExport>(`/exports/${exportId}/preview`, { method: "POST", body: JSON.stringify({ competence, events }) }),
  get: (exportId: string) => req<DominioExport>(`/exports/${exportId}`),
  send: (exportId: string) => req<DominioExport>(`/exports/${exportId}/enviar`, { method: "POST" }),
};
