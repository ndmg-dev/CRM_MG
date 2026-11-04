// Vigência de lotes e diferenças para exibir (regra do motor, docs/motor/04-api.md "Vigência do lote"): só se mostra.
import { formatarCompetencia } from "../../formato";
import type { Lote } from "../../tipos";

/** Tipos de diferença como o motor grava (com acento e espaço): INCLUÍDO, REMOVIDO, TRIBUTAÇÃO ALTERADA. */
export const INCLUIDO = "INCLUÍDO";
/** Data que o motor grava num lote de correção (sem vigência informada). */
const INICIO_CORRECAO = "2000-01-01";

type LoteVigencia = Pick<Lote, "vigencia_inicio" | "resumo">;

/** Lote sem vigência informada = correção de cadastro (vale para todos os meses). */
export function loteECorrecao(lote: LoteVigencia): boolean {
  return lote.resumo?.correcao ?? lote.vigencia_inicio === INICIO_CORRECAO;
}

/** Vigência do lote para exibir: "correção" ou "a partir de MM/AAAA". */
export function vigenciaDoLote(lote: LoteVigencia): string {
  return loteECorrecao(lote) ? "correção" : `a partir de ${formatarCompetencia(lote.vigencia_inicio)}`;
}

/** Vigência de cada diferença: item incluído vale sempre para todos os meses; as demais seguem o lote. */
export function vigenciaDaDiferenca(tipo: string, lote: LoteVigencia): string {
  return tipo === INCLUIDO ? "todos os meses" : vigenciaDoLote(lote);
}

/** Vigência no cabeçalho do lote: "Correção de cadastro" ou "Mudança a partir de MM/AAAA". */
export function vigenciaPorExtenso(lote: LoteVigencia): string {
  return loteECorrecao(lote) ? "Correção de cadastro" : `Mudança a partir de ${formatarCompetencia(lote.vigencia_inicio)}`;
}

/** Fim da frase de confirmação de remoções: "a partir de MM/AAAA" ou "em todos os meses". */
export function quandoDeixaDeValer(lote: LoteVigencia): string {
  return loteECorrecao(lote) ? "em todos os meses" : `a partir de ${formatarCompetencia(lote.vigencia_inicio)}`;
}
