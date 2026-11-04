// Pendências em lote (ADR-010 do motor): quais pendências entram em cada ação e como o envio é partido.
// Lógica pura (sem React) para testar em separado. O motor é quem valida a categoria e o estado das pendências.
import type { Pendencia, ResultadoResolucao } from "../../tipos";

/** Máximo por chamada ao BFF (teto do corpo JSON); o motor aceita até 1000. */
export const TAMANHO_LOTE = 400;

export interface Resolucao {
  pendencia_id: number;
  tributacao: string;
}

/** Pendências abertas com sugestão IDENTICA e consistente: as únicas que podem ser aceitas em lote. */
export const aceitaveis = (pendencias: Pendencia[]): Pendencia[] => pendencias.filter((p) => p.status === "ABERTA" && !!p.sugestao_aceitavel);

/** "Aceitar sugestão das selecionadas": só as selecionadas com sugestão aceitável, cada uma com a tributação do item sugerido. */
export function resolucoesPorSugestao(pendencias: Pendencia[], selecionadas: ReadonlySet<number>): Resolucao[] {
  return aceitaveis(pendencias)
    .filter((p) => selecionadas.has(p.id))
    .map((p) => ({ pendencia_id: p.id, tributacao: p.sugestao_aceitavel!.icms }));
}

/** "Gravar tributação nas selecionadas": todas as selecionadas abertas, com a tributação que o operador escolheu. */
export function resolucoesComTributacao(pendencias: Pendencia[], selecionadas: ReadonlySet<number>, tributacao: string): Resolucao[] {
  if (!tributacao) return [];
  return pendencias.filter((p) => p.status === "ABERTA" && selecionadas.has(p.id)).map((p) => ({ pendencia_id: p.id, tributacao }));
}

export function partir<T>(itens: T[], tamanho = TAMANHO_LOTE): T[][] {
  const partes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) partes.push(itens.slice(i, i + tamanho));
  return partes;
}

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

/** Soma os resultados dos blocos de um mesmo envio (`lote_id` não faz sentido somado: fica o do último com lote). */
export function somarResultados(a: ResultadoResolucao, b: ResultadoResolucao): ResultadoResolucao {
  return {
    resolvidas: a.resolvidas + b.resolvidas,
    adicionadas: a.adicionadas + b.adicionadas,
    sobrescritas: a.sobrescritas + b.sobrescritas,
    mantidas: a.mantidas + b.mantidas,
    ja_tratadas: a.ja_tratadas + b.ja_tratadas,
    lote_id: b.lote_id ?? a.lote_id,
  };
}

export const RESULTADO_VAZIO: ResultadoResolucao = { resolvidas: 0, adicionadas: 0, sobrescritas: 0, mantidas: 0, ja_tratadas: 0, lote_id: null };

/** Diz o que de fato aconteceu: item que já estava na memória é MANTIDO (a memória atual permanece), salvo se o operador pediu para sobrescrever. */
export function resumirResolucao(r: ResultadoResolucao): string {
  const partes: string[] = [];
  if (r.adicionadas) partes.push(`${plural(r.adicionadas, "cadastrada", "cadastradas")} na memória`);
  if (r.sobrescritas) partes.push(`${plural(r.sobrescritas, "sobrescrita", "sobrescritas")}`);
  if (r.mantidas) partes.push(`${r.mantidas.toLocaleString("pt-BR")} já ${r.mantidas === 1 ? "estava" : "estavam"} na memória e ${r.mantidas === 1 ? "foi mantida" : "foram mantidas"} como ${r.mantidas === 1 ? "está" : "estão"}`);
  if (r.ja_tratadas) partes.push(`${r.ja_tratadas.toLocaleString("pt-BR")} já ${r.ja_tratadas === 1 ? "tinha" : "tinham"} sido ${r.ja_tratadas === 1 ? "tratada" : "tratadas"} e não ${r.ja_tratadas === 1 ? "foi tocada" : "foram tocadas"}`);
  const base = r.resolvidas === 0 && r.ja_tratadas > 0 ? "Nenhuma pendência precisou ser resolvida" : plural(r.resolvidas, "pendência resolvida", "pendências resolvidas");
  return partes.length ? `${base}: ${partes.join("; ")}.` : `${base}.`;
}
