import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "../lib/api-types";
import { api, downloadFile, downloadFileJsonPost, downloadFilePost } from "../lib/api";

// ─── Tipos ──────────────────────────────────────────────────────────────────
// Os tipos de resposta/entrada da API são ALIASES sobre os schemas gerados de
// `lib/api-types.ts` (via `npm run gen:types`) — fonte única de verdade que
// acompanha o backend automaticamente, sem duplicar as formas à mão. Só ficam
// como interface manual os tipos que não têm schema no backend (ex.: as choices
// do /meta, que são um dict cru) ou tipos derivados (Omit<...>).
type Schemas = components["schemas"];

// Envelope de paginação (limit/offset) — igual ao Page[T] do backend.
export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export const PAGE_SIZE = 50;
/** Teto de `limit` aceito pela API (`backend/app/schemas/pagination.py::MAX_LIMIT`).
 * Pedir acima disso não devolve mais itens — devolve 422. */
export const MAX_PAGE_SIZE = 200;

export type Empresa = Schemas["CompanyOut"];
export type EmpresaInput = Omit<Empresa, "id" | "criado_em" | "atualizado_em">;

// /meta/choices devolve um dict cru (sem response_model) — sem schema gerado.
export interface Choice {
  value: string;
  label: string;
}
export interface ChoicesMap {
  company_tributacao: Choice[];
  company_porte: Choice[];
  company_perfil: Choice[];
  item_tributacao: Choice[];
  item_utilizacao: Choice[];
  user_role: Choice[];
  exception_tipo: Choice[];
  exception_acao: Choice[];
  exception_escopo: Choice[];
}

// ─── Meta (choices para selects) ──────────────────────────────────────────────
export function useChoices() {
  return useQuery({
    queryKey: ["choices"],
    queryFn: async () => (await api.get<ChoicesMap>("/meta/choices")).data,
    staleTime: Infinity,
  });
}

// ─── Conta do próprio usuário ─────────────────────────────────────────────────
export function useTrocarSenha() {
  return useMutation({
    mutationFn: async (payload: { senha_atual: string; senha_nova: string }) =>
      (await api.put("/auth/me/senha", payload)).data,
  });
}

// ─── Configurações do sistema (restrito a administrador) ─────────────────────
export interface Configuracoes {
  mfa_email_ativo: boolean;
  smtp_configurado: boolean;
  usuarios_sem_email: string[];
}

export function useConfiguracoes() {
  return useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => (await api.get<Configuracoes>("/configuracoes")).data,
  });
}

export function useSaveConfiguracoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { mfa_email_ativo?: boolean }) =>
      (await api.put<Configuracoes>("/configuracoes", data)).data,
    onSuccess: (data) => qc.setQueryData(["configuracoes"], data),
  });
}

// ─── Usuários (CRUD sobre auth_user, restrito a administrador) ────────────────
export type Usuario = Schemas["app__schemas__user__UserOut"];

// Entrada usada tanto p/ criar quanto p/ editar (senha opcional na edição) —
// não casa 1:1 com UserCreate/UserUpdate, então fica manual.
export interface UsuarioInput {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  password?: string;
  /** Só na criação — na edição os vínculos vão por `PUT /users/{id}/empresas`.
   * Vincular junto evita que o usuário nasça sem enxergar nada. */
  company_ids?: number[];
}

export const ROLE_LABEL: Record<string, string> = {
  administrador: "Administrador",
  coordenador: "Coordenador",
  operador: "Operador",
};

/** Lista paginada de usuários. Devolve o envelope `Page` inteiro (use
 * `data.total` para contagem global e `data.items` para as linhas). */
export function useUsuarios(params: { q?: string; offset?: number; limit?: number } = {}) {
  const { q, offset = 0, limit = PAGE_SIZE } = params;
  return useQuery({
    queryKey: ["usuarios", q ?? "", offset, limit],
    queryFn: async () =>
      (
        await api.get<Paged<Usuario>>("/users", {
          params: { limit, offset, ...(q ? { q } : {}) },
        })
      ).data,
  });
}

export function useUsuario(id: number | null) {
  return useQuery({
    queryKey: ["usuario", id],
    queryFn: async () => (await api.get<Usuario>(`/users/${id}`)).data,
    enabled: id != null,
  });
}

export function useSaveUsuario(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UsuarioInput) => {
      const res = id
        ? await api.put<Usuario>(`/users/${id}`, data)
        : await api.post<Usuario>("/users", data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

// ─── Vínculo usuário↔empresa (quais empresas o usuário enxerga) ─────────────
// O acesso é fail-closed: usuário sem vínculo não vê empresa nenhuma. Sem
// estas rotas, dar acesso a uma empresa já existente exigiria mexer no banco.
export type UsuarioEmpresas = Schemas["UserEmpresasOut"];

export function useUsuarioEmpresas(userId: number | null) {
  return useQuery({
    queryKey: ["usuario-empresas", userId],
    queryFn: async () => (await api.get<UsuarioEmpresas>(`/users/${userId}/empresas`)).data,
    enabled: userId != null,
  });
}

export function useSaveUsuarioEmpresas(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    // PUT substitui o conjunto: o que não vier na lista é desvinculado.
    mutationFn: async (companyIds: number[]) =>
      (await api.put<UsuarioEmpresas>(`/users/${userId}/empresas`, { company_ids: companyIds })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuario-empresas", userId] });
      // O escopo do próprio usuário logado pode ter mudado.
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
  });
}

// ─── Empresas ─────────────────────────────────────────────────────────────────
/** Lista paginada de empresas. Devolve o envelope `Page` inteiro — use em telas
 * de listagem (paginação) e para contagens globais via `data.total`. */
export interface EmpresaFiltros {
  q?: string;
  ativo?: boolean;
  /** Filtros de cadastro — usados pela tela de vínculos para marcar em bloco. */
  tributacao?: string;
  porte?: string;
  perfil?: string;
}

export function useEmpresasPage(
  params: EmpresaFiltros & { offset?: number; limit?: number } = {},
) {
  const { q, ativo, tributacao, porte, perfil, offset = 0, limit = PAGE_SIZE } = params;
  return useQuery({
    queryKey: [
      "empresas", "page", q ?? "", ativo ?? null,
      tributacao ?? "", porte ?? "", perfil ?? "", offset, limit,
    ],
    queryFn: async () =>
      (
        await api.get<Paged<Empresa>>("/empresas", {
          params: {
            limit,
            offset,
            ...(q ? { q } : {}),
            ...(ativo != null ? { ativo } : {}),
            ...(tributacao ? { tributacao } : {}),
            ...(porte ? { porte } : {}),
            ...(perfil ? { perfil } : {}),
          },
        })
      ).data,
  });
}

/** Busca server-side de empresas para seletores/lookups. Devolve só os `items`
 * (limitados). A busca por nome/CNPJ é feita no servidor, então empresas além
 * do limite continuam encontráveis digitando — não carregue a base inteira. */
export function useEmpresas(q: string, opts: { ativo?: boolean; limit?: number } = {}) {
  const { ativo, limit = PAGE_SIZE } = opts;
  return useQuery({
    queryKey: ["empresas", "busca", q ?? "", ativo ?? null, limit],
    queryFn: async () =>
      (
        await api.get<Paged<Empresa>>("/empresas", {
          params: { limit, ...(q ? { q } : {}), ...(ativo != null ? { ativo } : {}) },
        })
      ).data.items,
  });
}

export function useEmpresa(id: number | null) {
  return useQuery({
    queryKey: ["empresa", id],
    queryFn: async () => (await api.get<Empresa>(`/empresas/${id}`)).data,
    enabled: id != null,
  });
}

export function useSaveEmpresa(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: EmpresaInput) => {
      const res = id
        ? await api.put<Empresa>(`/empresas/${id}`, data)
        : await api.post<Empresa>("/empresas", data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
  });
}

export function useDeleteEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/empresas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresas"] }),
  });
}

export type EmpresaUso = Schemas["CompanyUsoOut"];

export async function fetchEmpresaUso(id: number): Promise<EmpresaUso> {
  return (await api.get<EmpresaUso>(`/empresas/${id}/uso`)).data;
}

/** Busca empresa pelo CNPJ (só dígitos). Rejeita com 404 se não cadastrada —
 * usado pela etapa de contexto do wizard para auto-detectar o destinatário. */
export async function fetchEmpresaPorCnpj(cnpj: string): Promise<Empresa> {
  const digits = (cnpj || "").replace(/\D/g, "");
  return (await api.get<Empresa>(`/empresas/por-cnpj/${digits}`)).data;
}

// ─── Regras NCM / MVA ─────────────────────────────────────────────────────────
export type NcmRule = Schemas["NCMRuleOut"];
export type NcmRuleInput = Omit<NcmRule, "id">;

/** Regras NCM da empresa. A regra é SEMPRE por empresa (ver README, "Fim das
 * regras NCM globais"), então a listagem só roda com `companyId` — sem ele a
 * tela misturaria a classificação de contribuintes diferentes, que é
 * exatamente o que não se pode fazer ao decidir tributação. */
export function useNcmRules(companyId: number | null, ncm: string, offset = 0) {
  return useQuery({
    queryKey: ["ncm-rules", companyId, ncm, offset],
    queryFn: async () =>
      (
        await api.get<Paged<NcmRule>>("/ncm-rules", {
          params: { company_id: companyId, ...(ncm ? { ncm } : {}), limit: PAGE_SIZE, offset },
        })
      ).data,
    enabled: companyId != null,
  });
}

export function useNcmRule(id: number | null) {
  return useQuery({
    queryKey: ["ncm-rule", id],
    queryFn: async () => (await api.get<NcmRule>(`/ncm-rules/${id}`)).data,
    enabled: id != null,
  });
}

export function useSaveNcmRule(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: NcmRuleInput) => {
      const res = id
        ? await api.put<NcmRule>(`/ncm-rules/${id}`, data)
        : await api.post<NcmRule>("/ncm-rules", data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ncm-rules"] });
    },
  });
}

export function useDeleteNcmRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/ncm-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ncm-rules"] }),
  });
}

export type NcmRuleResolved = Schemas["NCMRuleResolveItemOut"];

export function useResolveNcmRules() {
  return useMutation({
    mutationFn: async (payload: { company_id: number | null; items: { ncm: string; descricao: string }[] }) =>
      (await api.post<NcmRuleResolved[]>("/ncm-rules/resolve", payload)).data,
  });
}

// ─── Importação (Smart Import) — planilha de MVA/tributação → memória ────────
export type SmartImportRow = Schemas["SmartImportRowOut"];
export type SmartImportPreviewResultado = Schemas["SmartImportPreviewOut"];
export type SmartImportSaveRow = Schemas["SmartImportSaveRowIn"];

export function useSmartImportPreview() {
  return useMutation({
    mutationFn: async (payload: { memoryFile: File; xmlFiles: File[] }) => {
      const form = new FormData();
      form.append("memory_file", payload.memoryFile);
      for (const f of payload.xmlFiles) form.append("xml_files", f);
      return (await api.post<SmartImportPreviewResultado>("/smart-import/preview", form)).data;
    },
  });
}

export function useSmartImportSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { companyId: number; rows: SmartImportSaveRow[] }) =>
      (
        await api.post<{ saved: number }>("/smart-import/salvar", {
          company_id: payload.companyId,
          rows: payload.rows,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ncm-rules"] }),
  });
}

export async function downloadSmartImportTemplate(): Promise<void> {
  return downloadFile("/smart-import/template", "MODELO_MEMORIA_MVA.xlsx");
}

// ─── Exceções fiscais (fronteira_fiscal_exception) ────────────────────────────
export type FiscalException = Schemas["FiscalExceptionOut"];
export type FiscalExceptionInput = Omit<FiscalException, "id" | "criado_em" | "atualizado_em">;

export const EXCECAO_TIPO_LABEL: Record<string, string> = { ncm: "NCM", cfop: "CFOP", cst: "CST" };
export const EXCECAO_ACAO_LABEL: Record<string, string> = {
  ignorar: "Ignorar",
  forcar: "Forçar",
};

export function useExcecoes(q: string, tipo: string) {
  return useQuery({
    queryKey: ["excecoes", q, tipo],
    queryFn: async () =>
      (
        await api.get<FiscalException[]>("/excecoes", {
          params: { ...(q ? { q } : {}), ...(tipo ? { tipo } : {}) },
        })
      ).data,
  });
}

export function useExcecao(id: number | null) {
  return useQuery({
    queryKey: ["excecao", id],
    queryFn: async () => (await api.get<FiscalException>(`/excecoes/${id}`)).data,
    enabled: id != null,
  });
}

export function useSaveExcecao(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: FiscalExceptionInput) => {
      const res = id
        ? await api.put<FiscalException>(`/excecoes/${id}`, data)
        : await api.post<FiscalException>("/excecoes", data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["excecoes"] }),
  });
}

export function useDeleteExcecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/excecoes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["excecoes"] }),
  });
}

// ─── Comparação SEFAZ ─────────────────────────────────────────────────────────
export type ComparacaoItem = Schemas["ComparacaoItemOut"];
export type Comparacao = Schemas["ComparacaoOut"];
export type ComparacaoDetalhe = Schemas["ComparacaoDetalheOut"];

export const COMPARACAO_STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  tolerancia: "Tolerância",
  divergente: "Divergente",
  match_parcial: "CNPJ diferente",
  apenas_sefaz: "Apenas SEFAZ",
  apenas_sistema: "Apenas Sistema",
};

export const COMPARACAO_STATUS_VARIANT: Record<string, "ok" | "warn" | "err" | "neutral"> = {
  ok: "ok",
  tolerancia: "warn",
  divergente: "err",
  match_parcial: "warn",
  apenas_sefaz: "neutral",
  apenas_sistema: "neutral",
};

export function useComparacoes(companyId: number | null, offset = 0) {
  return useQuery({
    queryKey: ["comparacoes", companyId, offset],
    queryFn: async () =>
      (
        await api.get<Paged<Comparacao>>("/comparacao", {
          params: { ...(companyId != null ? { company_id: companyId } : {}), limit: PAGE_SIZE, offset },
        })
      ).data,
  });
}

export function useComparacao(id: number | null) {
  return useQuery({
    queryKey: ["comparacao", id],
    queryFn: async () => (await api.get<ComparacaoDetalhe>(`/comparacao/${id}`)).data,
    enabled: id != null,
  });
}

export function useCriarComparacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { file: File; companyId: number | null; competencia: string; tolerancia: string }) => {
      const form = new FormData();
      form.append("file", payload.file);
      if (payload.companyId != null) form.append("company_id", String(payload.companyId));
      form.append("competencia", payload.competencia);
      form.append("tolerancia", payload.tolerancia);
      return (await api.post<ComparacaoDetalhe>("/comparacao", form)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comparacoes"] }),
  });
}

export function useSalvarObservacoes(comparacaoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (observacoes: { item_id: number; observacao: string }[]) =>
      (await api.put<{ total_atualizados: number }>(`/comparacao/${comparacaoId}/observacoes`, { observacoes })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comparacao", comparacaoId] }),
  });
}

export function useExportComparacao() {
  return useMutation({
    mutationFn: async (comparacaoId: number) =>
      downloadFile(`/comparacao/${comparacaoId}/export`, `comparacao_sefaz_${comparacaoId}.xlsx`),
  });
}

// ─── XML NF-e ─────────────────────────────────────────────────────────────────
// Tipos da nota parseada, usados pelo wizard e pela Antecipação. A rota
// `/xml/parse` (parser isolado, uma nota por vez) continua existindo e
// testada no backend, mas nenhuma tela a consome: o wizard usa
// `/wizard/upload` e a Antecipação usa `/antecipacao/parse`, ambas em lote.
export type NFeItem = Schemas["NFeItemOut"];
export type NFeParsed = Schemas["NFeParseOut"];

// ─── Cálculo Fronteira ────────────────────────────────────────────────────────
export type CalcStep = Schemas["CalcStep"];
export type CalcResponse = Schemas["CalcResponse"];

export function useCalcularFronteira() {
  return useMutation({
    mutationFn: async (payload: unknown) =>
      (await api.post<CalcResponse>("/calculo/fronteira", payload)).data,
  });
}

// ─── Wizard de Fronteira ───────────────────────────────────────────────────
export type WizardItemIn = Schemas["WizardItemIn"];
export type WizardFinalizarInput = Schemas["WizardFinalizarIn"];
export type WizardItemResultado = Schemas["WizardItemResultOut"];
export type WizardFinalizarResultado = Schemas["WizardFinalizarOut"];

export function useFinalizarWizard() {
  return useMutation({
    mutationFn: async (payload: WizardFinalizarInput) =>
      (await api.post<WizardFinalizarResultado>("/wizard/finalizar", payload)).data,
  });
}

// Upload múltiplo (XML avulso e/ou ZIP) com detecção de duplicatas — etapa 1
// do wizard multi-nota.
export type WizardDuplicata = Schemas["WizardDuplicataOut"];
export type WizardUploadResultado = Schemas["WizardUploadOut"];

export function useWizardUpload() {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      return (await api.post<WizardUploadResultado>("/wizard/upload", form)).data;
    },
  });
}

// Conferência: quais itens do XML devem ser ignorados por exceção fiscal ativa.
export type WizardExcecaoResult = Schemas["WizardExcecaoOut"];

export function useAplicarExcecoesWizard() {
  return useMutation({
    mutationFn: async (items: { numero_item: number; ncm: string; cfop: string; cst: string }[]) =>
      (await api.post<WizardExcecaoResult[]>("/wizard/excecoes", { items })).data,
  });
}

// ─── Exportações XLSX ─────────────────────────────────────────────────────────
export function useExportFronteira() {
  return useMutation({
    mutationFn: async (invoiceId: number) =>
      downloadFile(`/wizard/${invoiceId}/export`, `fronteira_nf_${invoiceId}.xlsx`),
  });
}

export function useExportFronteiraPdf() {
  return useMutation({
    mutationFn: async (invoiceId: number) =>
      downloadFile(`/wizard/${invoiceId}/export-pdf`, `fronteira_nf_${invoiceId}.pdf`),
  });
}

// Exporta toda a apuração (todas as notas já calculadas) de uma empresa numa
// competência num único arquivo — botão "Exportar apuração" do Resultado.
export function useExportFronteiraGrupo() {
  return useMutation({
    mutationFn: async (payload: { companyId: number; competencia: string }) =>
      downloadFile(
        `/wizard/export?company_id=${payload.companyId}&competencia=${payload.competencia}`,
        `fronteira_apuracao_${payload.companyId}_${payload.competencia}.xlsx`,
      ),
  });
}

export function useExportFronteiraGrupoPdf() {
  return useMutation({
    mutationFn: async (payload: { companyId: number; competencia: string }) =>
      downloadFile(
        `/wizard/export-pdf?company_id=${payload.companyId}&competencia=${payload.competencia}`,
        `fronteira_apuracao_${payload.companyId}_${payload.competencia}.pdf`,
      ),
  });
}

// "Exportar tudo": um ZIP com um XLSX por grupo (empresa, competência) — pro
// envio que mistura várias empresas/competências.
export function useExportFronteiraZip() {
  return useMutation({
    mutationFn: async (grupos: { company_id: number; competencia: string }[]) =>
      downloadFileJsonPost("/wizard/export-zip", { grupos }, "FRONTEIRA_APURACOES.zip"),
  });
}

// Baixa o XLSX de uma competência sem passar por mutation (usado no loop de
// "exportar várias" da lista de Histórico, um arquivo por competência).
export async function exportarFronteiraGrupoXlsx(companyId: number, competencia: string): Promise<void> {
  return downloadFile(
    `/wizard/export?company_id=${companyId}&competencia=${competencia}`,
    `fronteira_apuracao_${companyId}_${competencia}.xlsx`,
  );
}

// ─── Histórico de apurações (por empresa / competência) ──────────────────────
export type HistoricoResumo = Schemas["HistoricoResumoOut"];
export type HistoricoCompetencia = Schemas["HistoricoCompetenciaOut"];
export type HistoricoDetalhe = Schemas["HistoricoDetalheOut"];
export type HistoricoNota = Schemas["HistoricoNotaOut"];
export type HistoricoItem = Schemas["HistoricoItemOut"];

export function useHistoricoCompetencias(companyId: number | null, ano: number | null) {
  return useQuery({
    queryKey: ["historico-competencias", companyId, ano],
    enabled: companyId != null,
    queryFn: async () =>
      (
        await api.get<HistoricoResumo>("/wizard/historico/competencias", {
          params: { company_id: companyId, ...(ano != null ? { ano } : {}) },
        })
      ).data,
  });
}

export function useHistoricoDetalhe(companyId: number | null, competencia: string | null) {
  return useQuery({
    queryKey: ["historico-detalhe", companyId, competencia],
    enabled: companyId != null && competencia != null,
    queryFn: async () =>
      (
        await api.get<HistoricoDetalhe>("/wizard/historico", {
          params: { company_id: companyId, competencia },
        })
      ).data,
  });
}

// ─── IBS/CBS (Reforma Tributária) — verificação pontual em NF-e ─────────────
export type IBSCBSResultado = Schemas["IBSCBSVerificarOut"];
export type IBSCBSNota = Schemas["IBSCBSNotaOut"];

export function useVerificarIBSCBS() {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      return (await api.post<IBSCBSResultado>("/ibscbs/verificar", form)).data;
    },
  });
}

// Reenvia os mesmos arquivos já analisados pra gerar o XLSX (a verificação
// não persiste nada, então não há "resultado salvo" no servidor pra
// reexportar — ver README, "Utilitários — Verificação de IBS/CBS").
export function useExportarIBSCBS() {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      return downloadFilePost("/ibscbs/exportar", form, "VERIFICACAO_IBSCBS.xlsx");
    },
  });
}

// ─── Antecipação — memória (NCM+descrição → tributação) ────────────────────
export type AntecipacaoMemoria = Schemas["AntecipacaoMemoriaOut"];

export type AntecipacaoMemoriaInput = Omit<
  AntecipacaoMemoria,
  "id" | "descricao_normalizada" | "criado_em" | "atualizado_em"
>;

export const TRIBUTACAO_ANTECIPACAO_LABEL: Record<string, string> = {
  normal_205: "Normal 20,5%",
  normal_225: "Normal 22,5%",
  normal_25: "Normal 25%",
  normal_27: "Normal 27%",
  nst_205: "NST 20,5%",
  nst_25: "NST 25%",
  st: "ST",
  isento: "Isento",
  uso: "Uso",
  cesta_basica: "Cesta Básica",
  gado: "Gado",
  pescado: "Pescado",
};

export interface AntecipacaoMemoriaFiltros {
  companyId?: string;
  ncm?: string;
  descricao?: string;
  tributacao?: string;
  ano?: string;
  mes?: string;
}

export function useAntecipacaoMemorias(filtros: AntecipacaoMemoriaFiltros, offset = 0) {
  const { companyId, ncm, descricao, tributacao, ano, mes } = filtros;
  return useQuery({
    queryKey: ["antecipacao-memorias", companyId, ncm, descricao, tributacao, ano, mes, offset],
    queryFn: async () =>
      (
        await api.get<Paged<AntecipacaoMemoria>>("/antecipacao/memoria", {
          params: {
            ...(companyId ? { company_id: companyId } : {}),
            ...(ncm ? { ncm } : {}),
            ...(descricao ? { descricao } : {}),
            ...(tributacao ? { tributacao } : {}),
            ...(ano ? { ano } : {}),
            ...(mes ? { mes } : {}),
            limit: PAGE_SIZE,
            offset,
          },
        })
      ).data,
  });
}

// ─── Memória de Tributação — listagem AGRUPADA ──────────────────────────────
// Cada linha é um GRUPO: entradas por-empresa com o mesmo ncm+descrição+
// tributação viram uma linha só ("aplica-se a N empresas"). Não existe mais
// escopo global — replicar entre empresas é sempre cópia explícita (ver
// useCopiarAntecipacaoMemoria / useCopiarAntecipacaoMemoriaEmpresa abaixo).

export type AntecipacaoMemoriaGrupo = Schemas["AntecipacaoMemoriaGrupoOut"];

export interface AntecipacaoMemoriaGrupoFiltros {
  ncm?: string;
  descricao?: string;
  tributacao?: string;
  /** "qualquer" | "grupos" | "empresa_especifica" */
  aplicaSeA?: string;
}

export function useAntecipacaoMemoriasAgrupadas(filtros: AntecipacaoMemoriaGrupoFiltros, offset = 0) {
  const { ncm, descricao, tributacao, aplicaSeA } = filtros;
  return useQuery({
    queryKey: ["antecipacao-memorias-agrupadas", ncm, descricao, tributacao, aplicaSeA, offset],
    queryFn: async () =>
      (
        await api.get<Paged<AntecipacaoMemoriaGrupo>>("/antecipacao/memoria-agrupada", {
          params: {
            ...(ncm ? { ncm } : {}),
            ...(descricao ? { descricao } : {}),
            ...(tributacao ? { tributacao } : {}),
            ...(aplicaSeA && aplicaSeA !== "qualquer" ? { aplica_se_a: aplicaSeA } : {}),
            limit: PAGE_SIZE,
            offset,
          },
        })
      ).data,
  });
}

function _invalidarMemoriaAgrupada(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["antecipacao-memorias-agrupadas"] });
  qc.invalidateQueries({ queryKey: ["antecipacao-memorias"] });
}

/** Cria item(ns) novo(s) e independente(s) a partir de um ou mais itens de
 * origem, em uma ou mais empresas de destino — nunca apaga/altera a origem.
 * Pra replicar a memória INTEIRA de uma empresa pra outra de uma vez, ver
 * `useCopiarAntecipacaoMemoriaEmpresa`; este hook é pra seleção pontual. */
export function useCopiarAntecipacaoMemoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { itemIds: number[]; companyIds: number[] }) =>
      (
        await api.post<{ total_criados: number }>("/antecipacao/memoria/copiar", {
          item_ids: payload.itemIds,
          company_ids: payload.companyIds,
        })
      ).data,
    onSuccess: () => _invalidarMemoriaAgrupada(qc),
  });
}

// ─── Copiar a memória INTEIRA de uma empresa para outra ────────────────────
// Pro caso comum "empresa nova parecida com uma que já existe" — em vez de
// selecionar item a item, mostra uma prévia (novo/sem_mudança/conflito, mesmo
// padrão do import de planilha) antes de aplicar.

export type AntecipacaoMemoriaCopiarEmpresaConflito = Schemas["AntecipacaoMemoriaCopiarEmpresaConflitoOut"];
export type AntecipacaoMemoriaCopiarEmpresaPreview = Schemas["AntecipacaoMemoriaCopiarEmpresaPreviewOut"];

export function usePreviewCopiarAntecipacaoMemoriaEmpresa() {
  return useMutation({
    mutationFn: async (payload: { companyIdOrigem: number; companyIdDestino: number }) =>
      (
        await api.post<AntecipacaoMemoriaCopiarEmpresaPreview>("/antecipacao/memoria/copiar-empresa/preview", {
          company_id_origem: payload.companyIdOrigem,
          company_id_destino: payload.companyIdDestino,
        })
      ).data,
  });
}

export function useCopiarAntecipacaoMemoriaEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      companyIdOrigem: number;
      companyIdDestino: number;
      sobrescreverItemIds: number[];
    }) =>
      (
        await api.post<{ total_criados: number; total_atualizados: number }>("/antecipacao/memoria/copiar-empresa", {
          company_id_origem: payload.companyIdOrigem,
          company_id_destino: payload.companyIdDestino,
          sobrescrever_item_ids: payload.sobrescreverItemIds,
        })
      ).data,
    onSuccess: () => _invalidarMemoriaAgrupada(qc),
  });
}

/** Edita descrição/tributação de um grupo inteiro (todas as empresas que
 * compartilham o mesmo ncm+descrição+tributação) de uma vez. */
export function useEditarGrupoAntecipacaoMemoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { itemIds: number[]; descricao: string; tributacao: string }) =>
      (
        await api.put<{ total_afetados: number }>("/antecipacao/memoria/grupo", {
          item_ids: payload.itemIds,
          descricao: payload.descricao,
          tributacao: payload.tributacao,
        })
      ).data,
    onSuccess: () => _invalidarMemoriaAgrupada(qc),
  });
}

/** Exclui um grupo inteiro (todas as linhas por-empresa daquele
 * ncm+descrição+tributação) de uma vez. */
export function useExcluirGrupoAntecipacaoMemoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemIds: number[]) =>
      (
        await api.delete<{ total_afetados: number }>("/antecipacao/memoria/grupo", {
          data: { item_ids: itemIds },
        })
      ).data,
    onSuccess: () => _invalidarMemoriaAgrupada(qc),
  });
}

// A memória é por empresa: zerar SEMPRE exige o `companyId`. O backend recusa
// a chamada sem ele (422) justamente para que nenhum cliente antigo volte a
// apagar o catálogo de todos os contribuintes de uma vez.
export function useZerarMemoriaAntecipacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, senha }: { companyId: number; senha: string }) =>
      (
        await api.delete<{ total_removidas: number }>("/antecipacao/memoria", {
          params: { company_id: companyId },
          data: { senha },
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-memorias"] }),
  });
}

export function useAntecipacaoMemoria(id: number | null) {
  return useQuery({
    queryKey: ["antecipacao-memoria", id],
    queryFn: async () => (await api.get<AntecipacaoMemoria>(`/antecipacao/memoria/${id}`)).data,
    enabled: id != null,
  });
}

export function useSaveAntecipacaoMemoria(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AntecipacaoMemoriaInput) => {
      const res = id
        ? await api.put<AntecipacaoMemoria>(`/antecipacao/memoria/${id}`, data)
        : await api.post<AntecipacaoMemoria>("/antecipacao/memoria", data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-memorias"] }),
  });
}

export function useDeleteAntecipacaoMemoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/antecipacao/memoria/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-memorias"] }),
  });
}

export type AntecipacaoPreviewRow = Schemas["AntecipacaoMemoriaPreviewRow"];
export type AntecipacaoPreviewResultado = Schemas["AntecipacaoMemoriaPreviewOut"];

export function usePreviewAntecipacaoMemoria() {
  return useMutation({
    mutationFn: async ({ file, companyId }: { file: File; companyId: number }) => {
      const form = new FormData();
      form.append("file", file);
      // A prévia compara com a memória DA EMPRESA — sem o company_id o
      // "novo/sem mudança/conflito" seria calculado contra o catálogo errado.
      form.append("company_id", String(companyId));
      return (await api.post<AntecipacaoPreviewResultado>("/antecipacao/memoria/preview", form)).data;
    },
  });
}

export type AntecipacaoSalvarRow = Schemas["AntecipacaoMemoriaSalvarRow"];

export function useSalvarAntecipacaoMemoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, rows }: { companyId: number; rows: AntecipacaoSalvarRow[] }) =>
      (
        await api.post<{ total_criados: number; total_atualizados: number }>("/antecipacao/memoria/salvar", {
          company_id: companyId,
          rows,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-memorias"] }),
  });
}

// ─── Antecipação — processamento por empresa + competência (sem lote) ──────
export type AntecipacaoCompetenciaResumo = Schemas["AntecipacaoCompetenciaOut"];
export type AntecipacaoItemLote = Schemas["AntecipacaoItemLoteOut"];
export type AntecipacaoInvoiceLote = Schemas["AntecipacaoInvoiceOut"];
export type AntecipacaoCompetenciaDetalhe = Schemas["AntecipacaoCompetenciaDetalheOut"];
export type AntecipacaoPendente = Schemas["AntecipacaoPendenteOut"];

/** Competências com nota importada para a empresa, com totais e situação —
 * alimenta a tela Histórico (mesmo papel do Histórico de Fronteira). */
export function useAntecipacaoCompetencias(companyId: number | null) {
  return useQuery({
    queryKey: ["antecipacao-competencias", companyId],
    queryFn: async () =>
      (await api.get<AntecipacaoCompetenciaResumo[]>("/antecipacao/competencias", { params: { company_id: companyId } })).data,
    enabled: companyId != null,
  });
}

export function useAntecipacaoCompetencia(companyId: number | null, competencia: string | null) {
  return useQuery({
    queryKey: ["antecipacao-competencia", companyId, competencia],
    queryFn: async () => (await api.get<AntecipacaoCompetenciaDetalhe>(`/antecipacao/${companyId}/${competencia}`)).data,
    enabled: companyId != null && !!competencia,
  });
}

export function useAntecipacaoPendentes(companyId: number | null, competencia: string | null) {
  return useQuery({
    queryKey: ["antecipacao-pendentes", companyId, competencia],
    queryFn: async () => (await api.get<AntecipacaoPendente[]>(`/antecipacao/${companyId}/${competencia}/pendentes`)).data,
    enabled: companyId != null && !!competencia,
  });
}

export type AntecipacaoMemoriaSugestao = Schemas["AntecipacaoMemoriaSugestaoOut"];

/** Classificações que OUTRAS empresas (visíveis ao usuário) já deram ao
 * mesmo NCM+descrição dos itens ainda pendentes — só informativo, usado para
 * sugerir "usar essa classificação" ou "promover a global" na tela de
 * classificação. Nunca aplicado sozinho. */
export function useAntecipacaoSugestoes(companyId: number | null, competencia: string | null) {
  return useQuery({
    queryKey: ["antecipacao-sugestoes", companyId, competencia],
    queryFn: async () =>
      (await api.get<AntecipacaoMemoriaSugestao[]>(`/antecipacao/${companyId}/${competencia}/sugestoes`)).data,
    enabled: companyId != null && !!competencia,
  });
}

function _invalidarAntecipacao(qc: ReturnType<typeof useQueryClient>, companyId: number, competencia: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["antecipacao-competencia", companyId, competencia] }),
    qc.invalidateQueries({ queryKey: ["antecipacao-pendentes", companyId, competencia] }),
    qc.invalidateQueries({ queryKey: ["antecipacao-competencias", companyId] }),
  ]);
}

// Fluxo igual ao wizard de Fronteira: (1) parse só devolve as notas, o cliente
// agrupa por (CNPJ destinatário + competência) e resolve as empresas;
// (2) importar persiste as notas já com o company_id de cada grupo.
export type AntecipacaoImportarNota = Schemas["AntecipacaoImportarNotaIn"];
export type AntecipacaoImportarBulk = Schemas["AntecipacaoImportarBulkOut"];

export type AntecipacaoParseResultado = Schemas["AntecipacaoParseOut"];

export function useAntecipacaoParse() {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      // devolve { invoices, errors } — erros por arquivo (ex.: NFS-e) aparecem na tela
      return (await api.post<AntecipacaoParseResultado>("/antecipacao/parse", form)).data;
    },
  });
}

export function useImportarAntecipacaoNotas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notas: AntecipacaoImportarNota[]) =>
      (await api.post<AntecipacaoImportarBulk>("/antecipacao/importar", { notas })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-competencias"] }),
  });
}

// Remove as notas de um conjunto de chaves dentro de uma (empresa,
// competência) — usado ao voltar ao Contexto e remapear a empresa (limpa o
// que já foi importado antes de reimportar). Escopado no backend: nunca
// remove notas de outra empresa/competência mesmo que reutilizem a chave.
export type AntecipacaoRemoverNotasRequest = Schemas["AntecipacaoRemoverNotasRequest"];

export function useRemoverNotasAntecipacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AntecipacaoRemoverNotasRequest) =>
      (await api.post<{ total_removidas: number }>("/antecipacao/remover-notas", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-competencias"] }),
  });
}

export function useExportAntecipacaoZip() {
  return useMutation({
    mutationFn: async (grupos: { company_id: number; competencia: string }[]) =>
      downloadFileJsonPost("/antecipacao/export-zip", { grupos }, "ANTECIPACAO_APURACOES.zip"),
  });
}

// Baixa os itens pendentes (não classificados) das apurações num XLSX pra
// classificar no Excel e reimportar na memória.
export function useExportPendentesAntecipacao() {
  return useMutation({
    mutationFn: async (grupos: { company_id: number; competencia: string }[]) =>
      downloadFileJsonPost("/antecipacao/pendentes/export", { grupos }, "PENDENTES_ANTECIPACAO.xlsx"),
  });
}

export async function downloadModeloMemoriaAntecipacao(): Promise<void> {
  return downloadFile("/antecipacao/memoria/modelo", "MODELO_MEMORIA_ANTECIPACAO.xlsx");
}

export async function exportarMemoriaAntecipacao(companyId: number): Promise<void> {
  return downloadFile(
    `/antecipacao/memoria/export?company_id=${companyId}`,
    "MEMORIA_ANTECIPACAO.xlsx",
  );
}

export function useClassificarLoteAntecipacao(companyId: number, competencia: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { itemIds: number[]; tributacao: string }) =>
      (
        await api.put<{ total_classificados: number; total_pendentes: number }>(
          `/antecipacao/${companyId}/${competencia}/classificar-lote`,
          { item_ids: payload.itemIds, tributacao: payload.tributacao },
        )
      ).data,
    onSuccess: () => _invalidarAntecipacao(qc, companyId, competencia),
  });
}

export interface AntecipacaoGrupoProcessamento {
  companyId: number;
  competencia: string;
}

export interface AntecipacaoProcessamentoLoteResultado {
  total: number;
  totalProcessados: number;
  falhas: Array<AntecipacaoGrupoProcessamento & { erro: unknown }>;
}

type AntecipacaoProcessamentoResultado = {
  total_classificados_automaticamente: number;
  total_pendentes: number;
};

// React StrictMode pode montar o mesmo grupo duas vezes em desenvolvimento.
// Compartilhar a Promise por chave evita POSTs duplicados sem impedir uma nova
// aplicação depois que a anterior terminou (reentrada/troca de apuração).
const processamentosAntecipacaoEmAndamento = new Map<string, Promise<AntecipacaoProcessamentoResultado>>();

function processarAntecipacaoGrupo(
  qc: ReturnType<typeof useQueryClient>,
  companyId: number,
  competencia: string,
): Promise<AntecipacaoProcessamentoResultado> {
  const key = `${companyId}-${competencia}`;
  const existente = processamentosAntecipacaoEmAndamento.get(key);
  if (existente) return existente;

  const processamento = api
    .post<AntecipacaoProcessamentoResultado>(`/antecipacao/${companyId}/${competencia}/processar`)
    .then(async (res) => {
      await _invalidarAntecipacao(qc, companyId, competencia);
      return res.data;
    })
    .finally(() => {
      if (processamentosAntecipacaoEmAndamento.get(key) === processamento) {
        processamentosAntecipacaoEmAndamento.delete(key);
      }
    });
  processamentosAntecipacaoEmAndamento.set(key, processamento);
  return processamento;
}

/** Aplica a memória a todos os grupos importados. Grupos repetidos são
 * consolidados e uma falha não impede os demais de serem processados. */
export function useProcessarAntecipacaoLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (grupos: AntecipacaoGrupoProcessamento[]): Promise<AntecipacaoProcessamentoLoteResultado> => {
      const unicos = [
        ...new Map(grupos.map((grupo) => [`${grupo.companyId}-${grupo.competencia}`, grupo])).values(),
      ];
      const resultados = await Promise.all(
        unicos.map(async (grupo) => {
          try {
            await processarAntecipacaoGrupo(qc, grupo.companyId, grupo.competencia);
            return { grupo, erro: null };
          } catch (erro) {
            return { grupo, erro };
          }
        }),
      );
      const falhas = resultados
        .filter((resultado) => resultado.erro !== null)
        .map(({ grupo, erro }) => ({ ...grupo, erro }));
      return { total: unicos.length, totalProcessados: unicos.length - falhas.length, falhas };
    },
  });
}

export function useProcessarAntecipacao(companyId: number, competencia: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => processarAntecipacaoGrupo(qc, companyId, competencia),
  });
}

export function useClassificarAntecipacaoItem(companyId: number, competencia: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { itemId: number; tributacao: string; valor_desconto?: string }) =>
      (
        await api.put<AntecipacaoItemLote>(`/antecipacao/${companyId}/${competencia}/itens/${payload.itemId}/classificar`, {
          tributacao: payload.tributacao,
          valor_desconto: payload.valor_desconto ?? null,
        })
      ).data,
    onSuccess: () => _invalidarAntecipacao(qc, companyId, competencia),
  });
}

export function useCalcularAntecipacao(companyId: number, competencia: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ total_itens: number; total_imposto: string }>(`/antecipacao/${companyId}/${competencia}/calcular`)).data,
    onSuccess: () => _invalidarAntecipacao(qc, companyId, competencia),
  });
}

export function useExportAntecipacao() {
  return useMutation({
    mutationFn: async ({ companyId, competencia }: { companyId: number; competencia: string }) =>
      downloadFile(`/antecipacao/${companyId}/${competencia}/export`, `antecipacao_${competencia}.xlsx`),
  });
}

// ─── Antecipação — tributações (catálogo de códigos, tela "Tributações") ────
export type AntecipacaoTributacaoTipo = Schemas["AntecipacaoTributacaoTipoOut"];
export type AntecipacaoTributacaoTipoInput = Omit<
  AntecipacaoTributacaoTipo,
  "id" | "padrao" | "ordem" | "criado_em" | "atualizado_em"
>;

export function useAntecipacaoTributacoes(ativo?: boolean) {
  return useQuery({
    queryKey: ["antecipacao-tributacoes", ativo ?? null],
    queryFn: async () =>
      (
        await api.get<AntecipacaoTributacaoTipo[]>("/antecipacao/tributacoes", {
          params: ativo != null ? { ativo } : {},
        })
      ).data,
  });
}

export function useCriarAntecipacaoTributacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AntecipacaoTributacaoTipoInput) =>
      (await api.post<AntecipacaoTributacaoTipo>("/antecipacao/tributacoes", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-tributacoes"] }),
  });
}

export function useAtualizarAntecipacaoTributacao(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<AntecipacaoTributacaoTipoInput, "codigo">) =>
      (await api.put<AntecipacaoTributacaoTipo>(`/antecipacao/tributacoes/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-tributacoes"] }),
  });
}

export function useDefinirPadraoAntecipacaoTributacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.post<AntecipacaoTributacaoTipo>(`/antecipacao/tributacoes/${id}/padrao`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-tributacoes"] }),
  });
}

export function useExcluirAntecipacaoTributacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/antecipacao/tributacoes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-tributacoes"] }),
  });
}

// ─── Antecipação — exceções (fronteira_antecipacao_excecao) ────────────────
export type AntecipacaoExcecaoTipo = Schemas["AntecipacaoExcecaoOut"];
export type AntecipacaoExcecaoTipoInput = Omit<AntecipacaoExcecaoTipo, "id" | "criado_em" | "atualizado_em">;

export function useAntecipacaoExcecoes(tipo?: string) {
  return useQuery({
    queryKey: ["antecipacao-excecoes", tipo ?? null],
    queryFn: async () =>
      (
        await api.get<AntecipacaoExcecaoTipo[]>("/antecipacao/excecoes", {
          params: tipo ? { tipo } : {},
        })
      ).data,
  });
}

export function useAntecipacaoExcecao(id: number | null) {
  return useQuery({
    queryKey: ["antecipacao-excecao", id],
    queryFn: async () => (await api.get<AntecipacaoExcecaoTipo>(`/antecipacao/excecoes/${id}`)).data,
    enabled: id != null,
  });
}

export function useSaveAntecipacaoExcecao(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AntecipacaoExcecaoTipoInput) => {
      const res = id
        ? await api.put<AntecipacaoExcecaoTipo>(`/antecipacao/excecoes/${id}`, data)
        : await api.post<AntecipacaoExcecaoTipo>("/antecipacao/excecoes", data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-excecoes"] }),
  });
}

export function useDeleteAntecipacaoExcecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/antecipacao/excecoes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["antecipacao-excecoes"] }),
  });
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
// Um hook por bloco, de propósito: o design exige que cada bloco carregue e
// falhe de forma independente (uma falha não derruba o dashboard inteiro), o
// que só funciona com queries separadas. Ver
// docs/design_handoff_dashboard_fiscal/README.md.

export type DashboardResumo = Schemas["DashboardResumoOut"];
export type DashboardPendencia = Schemas["DashboardPendenciaOut"];
export type DashboardSeries = Schemas["DashboardSeriesOut"];
export type DashboardSerie = Schemas["DashboardSerieOut"];
export type DashboardSaude = Schemas["DashboardSaudeOut"];
export type DashboardEmpresas = Schemas["DashboardEmpresasOut"];
export type DashboardEmpresaLinha = Schemas["DashboardEmpresaLinhaOut"];
export type DashboardEmpresaAberta = Schemas["DashboardEmpresaAbertaOut"];

export interface DashboardFiltros {
  competencia?: string;
  companyId?: number | null;
}

function _dashboardParams({ competencia, companyId }: DashboardFiltros) {
  return {
    ...(competencia ? { competencia } : {}),
    ...(companyId != null ? { company_id: companyId } : {}),
  };
}

export function useDashboardResumo(filtros: DashboardFiltros) {
  return useQuery({
    queryKey: ["dashboard", "resumo", filtros.competencia ?? "", filtros.companyId ?? "all"],
    queryFn: async () =>
      (await api.get<DashboardResumo>("/dashboard/resumo", { params: _dashboardParams(filtros) })).data,
  });
}

export function useDashboardPendencias(filtros: DashboardFiltros) {
  return useQuery({
    queryKey: ["dashboard", "pendencias", filtros.competencia ?? "", filtros.companyId ?? "all"],
    queryFn: async () =>
      (await api.get<DashboardPendencia[]>("/dashboard/pendencias", { params: _dashboardParams(filtros) })).data,
  });
}

export function useDashboardSeries(filtros: DashboardFiltros) {
  return useQuery({
    queryKey: ["dashboard", "series", filtros.competencia ?? "", filtros.companyId ?? "all"],
    queryFn: async () =>
      (await api.get<DashboardSeries>("/dashboard/series", { params: _dashboardParams(filtros) })).data,
  });
}

export function useDashboardSaude(filtros: DashboardFiltros) {
  return useQuery({
    queryKey: ["dashboard", "saude", filtros.companyId ?? "all"],
    queryFn: async () =>
      (await api.get<DashboardSaude>("/dashboard/saude", { params: _dashboardParams({ companyId: filtros.companyId }) })).data,
  });
}

export function useDashboardEmpresas(filtros: DashboardFiltros) {
  return useQuery({
    queryKey: ["dashboard", "empresas", filtros.competencia ?? "", filtros.companyId ?? "all"],
    queryFn: async () =>
      (await api.get<DashboardEmpresas>("/dashboard/empresas", { params: _dashboardParams(filtros) })).data,
  });
}
