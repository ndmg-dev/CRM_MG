/**
 * Curadoria de insights — tipos compartilhados entre a API e a UI.
 *
 * 🔴 Anotação NUNCA altera cálculo. Ela só sobrepõe TEXTO e acrescenta status e
 * comentário. Regra, limiares e números continuam vindo de metrics.ts/insights.ts.
 */

export const STATUS = ["em_aberto", "verificado", "descartado"] as const;
export type StatusAnotacao = (typeof STATUS)[number];

export function ehStatus(v: unknown): v is StatusAnotacao {
  return typeof v === "string" && (STATUS as readonly string[]).includes(v);
}

export interface Anotacao {
  /** chave estável do insight (ver Insight.chave) */
  chave: string;
  status: StatusAnotacao;
  comentario: string | null;
  /** sobrescrevem o texto gerado quando não-nulos */
  tituloEditado: string | null;
  descricaoEditada: string | null;
  acaoEditada: string | null;
  /**
   * Atribuição digitada pela pessoa. NÃO é autenticação — o site não tem login,
   * então este campo é declarativo e não deve ser tratado como prova de autoria.
   */
  autor: string | null;
  atualizadoEm: string;
}

/** Campos que o cliente pode enviar. `chave` vai à parte, na URL/corpo. */
export type AnotacaoEntrada = Partial<
  Pick<
    Anotacao,
    | "status"
    | "comentario"
    | "tituloEditado"
    | "descricaoEditada"
    | "acaoEditada"
    | "autor"
  >
>;

/**
 * Campos que podem ser apagados explicitamente (voltando ao texto gerado).
 * Nomes em snake_case porque são colunas — a API valida contra esta lista.
 */
export const CAMPOS_LIMPAVEIS = [
  "comentario",
  "titulo_editado",
  "descricao_editada",
  "acao_editada",
] as const;
export type CampoLimpavel = (typeof CAMPOS_LIMPAVEIS)[number];

/** Limites de tamanho — sem login, qualquer um escreve; evita abuso trivial. */
export const LIMITES = {
  chave: 200,
  comentario: 4000,
  titulo: 300,
  descricao: 4000,
  acao: 500,
  autor: 120,
} as const;

export interface RespostaAnotacoes {
  /** false quando o banco não está configurado — UI entra em modo leitura */
  persistencia: boolean;
  anotacoes: Anotacao[];
  aviso?: string;
}
