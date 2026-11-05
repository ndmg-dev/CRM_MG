// Cliente da API do módulo ICMS Saídas. Fala só com o backend do CRM (`/api/v1/icms-saidas/...`), que é o único a chamar o motor
// (a chave do motor nunca chega ao navegador). A sessão é a do CRM: JWT em `crm_token`. Os caminhos usados pelas telas começam
// por `/api/` (ex.: `/api/painel`) e são traduzidos aqui para `<base do CRM>/icms-saidas/painel`.

import { comCarregamento, textoDaRequisicao } from "./ui/carregando";

const RAIZ_API: string = import.meta.env.VITE_API_BASE_URL || "/api/v1";

/** `/api/painel?x=1` -> `<base>/icms-saidas/painel?x=1`. */
export function urlDoCaminho(caminho: string): string {
  return `${RAIZ_API}/icms-saidas${caminho.replace(/^\/api(?=\/)/, "")}`;
}

export interface ErroCorpo {
  codigo: string;
  mensagem: string;
  detalhes: string[];
}

export class ErroApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly detalhes: string[];

  constructor(status: number, erro: ErroCorpo) {
    super(erro.mensagem);
    this.status = status;
    this.codigo = erro.codigo;
    this.detalhes = erro.detalhes ?? [];
  }
}

function token(): string | null {
  try {
    return localStorage.getItem("crm_token");
  } catch {
    return null;
  }
}

async function lerErro(resposta: Response): Promise<ErroApi> {
  const corpo: unknown = await resposta.json().catch(() => null);
  const erro = (corpo as { erro?: ErroCorpo } | null)?.erro;
  if (erro && typeof erro.codigo === "string") {
    return new ErroApi(resposta.status, { ...erro, detalhes: Array.isArray(erro.detalhes) ? erro.detalhes : [] });
  }
  const detalheFastapi = (corpo as { detail?: unknown } | null)?.detail;
  if (typeof detalheFastapi === "string" && detalheFastapi) {
    return new ErroApi(resposta.status, { codigo: "ERRO_HTTP", mensagem: detalheFastapi, detalhes: [] });
  }
  return new ErroApi(resposta.status, {
    codigo: "ERRO_HTTP",
    mensagem: `Falha na comunicação com o servidor (HTTP ${resposta.status}).`,
    detalhes: [],
  });
}

let aoExpirar: () => void = irParaLogin;

/** Troca o que acontece quando o CRM responde 401 (os testes substituem; padrão: voltar ao login). */
export function definirAoExpirar(acao: (() => void) | null): void {
  aoExpirar = acao ?? irParaLogin;
}

/** Sessão do CRM vencida: volta ao login (como as demais telas do CRM). */
function irParaLogin(): void {
  try {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
  } catch {
    // sem armazenamento: só redireciona
  }
  window.location.href = "/login";
}

/** Requisição ao backend do CRM. Liga a tela de carregamento (bloqueia a página) enquanto espera; ver `ui/carregando.ts`. */
export function requisitar(metodo: string, caminho: string, corpo?: BodyInit | object): Promise<Response> {
  return comCarregamento(textoDaRequisicao(metodo, caminho), () => buscar(metodo, caminho, corpo));
}

async function buscar(metodo: string, caminho: string, corpo?: BodyInit | object): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (corpo instanceof FormData) {
    body = corpo; // o navegador define o Content-Type com a fronteira do multipart
  } else if (corpo !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(corpo);
  }
  const jwt = token();
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  let resposta: Response;
  try {
    resposta = await fetch(urlDoCaminho(caminho), { method: metodo, headers, body });
  } catch {
    throw new ErroApi(0, {
      codigo: "SEM_CONEXAO",
      mensagem: "Não foi possível falar com o servidor. Verifique a conexão.",
      detalhes: [],
    });
  }
  if (!resposta.ok) {
    const erro = await lerErro(resposta);
    if (erro.status === 401) aoExpirar();
    throw erro;
  }
  return resposta;
}

async function json<T>(metodo: string, caminho: string, corpo?: BodyInit | object): Promise<T> {
  // a tela de carregamento fica ligada também enquanto o corpo da resposta é lido
  return comCarregamento(textoDaRequisicao(metodo, caminho), async () => (await (await buscar(metodo, caminho, corpo)).json()) as T);
}

export const api = {
  get: <T>(caminho: string) => json<T>("GET", caminho),
  post: <T>(caminho: string, corpo?: object) => json<T>("POST", caminho, corpo ?? {}),
  patch: <T>(caminho: string, corpo: object) => json<T>("PATCH", caminho, corpo),
  put: <T>(caminho: string, corpo: object) => json<T>("PUT", caminho, corpo),
  enviar: <T>(caminho: string, formulario: FormData) => json<T>("POST", caminho, formulario),
};

/** Monta "?a=1&b=2" ignorando valores vazios. */
export function consulta(parametros: Record<string, string | number | boolean | null | undefined>): string {
  const busca = new URLSearchParams();
  for (const [nome, valor] of Object.entries(parametros)) {
    if (valor !== null && valor !== undefined && valor !== "") busca.set(nome, String(valor));
  }
  const texto = busca.toString();
  return texto ? `?${texto}` : "";
}

function nomeDoArquivo(disposicao: string | null, padrao: string): string {
  const estrela = disposicao?.match(/filename\*=UTF-8''([^;]+)/i);
  if (estrela) {
    try {
      return decodeURIComponent(estrela[1]);
    } catch {
      // usa o próximo formato
    }
  }
  const simples = disposicao?.match(/filename="?([^";]+)"?/i);
  return simples ? simples[1] : padrao;
}

/** Baixa um arquivo pelo backend do CRM (o token vai junto) e entrega ao navegador como download. */
export async function baixar(caminho: string, nomePadrao: string): Promise<void> {
  const { blob, nome } = await comCarregamento(textoDaRequisicao("GET", caminho), async () => {
    const resposta = await buscar("GET", caminho);
    return { blob: await resposta.blob(), nome: nomeDoArquivo(resposta.headers.get("content-disposition"), nomePadrao) };
  });
  salvarArquivo(blob, nome);
}

/** Envia um formulário (upload) e baixa a planilha devolvida. Devolve os cabeçalhos `X-Parcial-*` da resposta (resumo), em minúsculas. */
export async function enviarEBaixar(caminho: string, formulario: FormData, nomePadrao: string): Promise<Record<string, string>> {
  const { blob, nome, resumo } = await comCarregamento(textoDaRequisicao("POST", caminho), async () => {
    const resposta = await buscar("POST", caminho, formulario);
    const resumo: Record<string, string> = {};
    resposta.headers.forEach((valor, chave) => {
      if (chave.startsWith("x-parcial-")) resumo[chave] = valor;
    });
    return { blob: await resposta.blob(), nome: nomeDoArquivo(resposta.headers.get("content-disposition"), nomePadrao), resumo };
  });
  salvarArquivo(blob, nome);
  return resumo;
}

/** Entrega ao navegador, como download, um arquivo gerado na própria página. */
export function salvarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
