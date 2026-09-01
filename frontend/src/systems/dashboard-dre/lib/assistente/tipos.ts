/** Contrato entre a UI do assistente e a rota — sem dependência de servidor. */

export type { Escopo } from "../types";
export type { Tela } from "../escopo";

export type Papel = "user" | "assistant";

export interface Mensagem {
  papel: Papel;
  texto: string;
}

/** Contexto da tela, enviado junto para o assistente saber onde o usuário está. */
export interface ContextoDaTela {
  tela: string;
  escopo: string;
  meses: number[];
}

export interface RespostaAssistente {
  /** Resposta em texto. Ausente quando `erro` está presente. */
  texto?: string;
  /** Ferramentas consultadas — exibidas para o usuário poder conferir na tela. */
  consultou?: string[];
  erro?: string;
  /** false = assistente desligado por configuração; a UI se esconde. */
  disponivel: boolean;
}

export const LIMITES = {
  /** Caracteres por pergunta. */
  pergunta: 1000,
  /** Mensagens de histórico aceitas (pares usuário/assistente). */
  historico: 20,
  /** Rodadas de ferramenta por pergunta — teto de custo e de laço infinito. */
  rodadas: 6,
  /** Perguntas por IP por minuto. */
  porMinuto: 10,
} as const;
