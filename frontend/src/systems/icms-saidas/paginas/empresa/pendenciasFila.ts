// Fila de pendências: em que grupo cada uma cai, como achar o que difere do produto sugerido e a busca na página.
// Lógica pura (sem React) para testar em separado. Quem decide a tributação continua sendo o motor; aqui só se organiza a tela.
import type { Pendencia } from "../../tipos";

/** O que a pessoa precisa fazer com a pendência. */
export type Grupo = "pode" | "conferir" | "sem";

export const GRUPOS: { valor: Grupo; rotulo: string }[] = [
  { valor: "pode", rotulo: "Pode aceitar" },
  { valor: "conferir", rotulo: "Conferir" },
  { valor: "sem", rotulo: "Sem sugestão" },
];

/** "pode" = sugestão IDENTICA e consistente (a única elegível ao aceite sem conferir); "conferir" = há sugestão, mas só parecida ou ambígua. */
export function grupoDe(p: Pendencia): Grupo {
  if (p.sugestao_aceitavel) return "pode";
  return (p.sugestoes?.length ?? 0) > 0 ? "conferir" : "sem";
}

export function contarGrupos(itens: Pendencia[]): Record<Grupo, number> {
  const contagem: Record<Grupo, number> = { pode: 0, conferir: 0, sem: 0 };
  for (const p of itens) contagem[grupoDe(p)]++;
  return contagem;
}

/** Primeiro grupo que tem item, na ordem do trabalho (o mais seguro primeiro). */
export function grupoInicial(contagem: Record<Grupo, number>): Grupo {
  return GRUPOS.find((g) => contagem[g.valor] > 0)?.valor ?? "pode";
}

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export type Trecho = { texto: string; difere: boolean };

/** Palavras do `candidato` que NÃO existem no `produto` (ex.: "25KG" no lugar de "20KG"), para a pessoa ver o que muda antes de aceitar. */
export function destacarDiferencas(candidato: string, produto: string): Trecho[] {
  const conhecidas = new Set(normalizar(produto).split(/\s+/).filter(Boolean));
  return candidato
    .split(/\s+/)
    .filter(Boolean)
    .map((texto) => ({ texto, difere: !conhecidas.has(normalizar(texto)) }));
}

/** Filtro por descrição ou NCM (sem acento, sem maiúsculas); só sobre o que já está carregado na página. */
export function buscar(itens: Pendencia[], termo: string): Pendencia[] {
  const t = normalizar(termo.trim());
  if (!t) return itens;
  return itens.filter((p) => normalizar(p.descricao).includes(t) || p.ncm.includes(t));
}
