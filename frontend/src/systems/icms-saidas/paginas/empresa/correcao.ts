// Correção da importação da memória (ADR-009 do motor): estado das escolhas do operador → decisões enviadas ao motor.
// Lógica pura (sem React) para testar em separado. O motor é quem valida (categoria existente, problema correspondente).
import type { Decisao, ProblemasLote } from "../../tipos";

/** Escolha para uma categoria desconhecida: "" (sem decisão), IGNORAR ou o nome de uma categoria existente (prefixo `cat:`). */
export const IGNORAR = "ignorar";
const PREFIXO_CAT = "cat:";
export const valorCategoria = (nome: string) => `${PREFIXO_CAT}${nome}`;

export interface EscolhaLinha {
  ignorar: boolean;
  /** Valor digitado para o campo que falta (descrição, NCM ou ICMS). Vazio = sem correção. */
  valor: string;
}

export interface Escolhas {
  categorias: Record<string, string>; // texto normalizado → "" | "ignorar" | "cat:<nome>"
  linhas: Record<number, EscolhaLinha>;
  conflitos: Record<string, string>; // chave do conflito → categoria escolhida ("" = sem decisão)
}

export const chaveConflito = (descricao: string, ncm: string) => `${descricao}|${ncm}`;

const texto = (v: unknown): string => (typeof v === "string" ? v : "");

/** Escolhas iniciais = decisões já gravadas no lote (para rever e alterar). */
export function escolhasIniciais(p: ProblemasLote): Escolhas {
  const categorias: Escolhas["categorias"] = {};
  for (const c of p.categorias) {
    const d = c.decisao;
    categorias[c.texto] = !d ? "" : d.tipo === "IGNORAR_CATEGORIA" ? IGNORAR : d.tipo === "MAPEAR_CATEGORIA" ? valorCategoria(texto(d.categoria)) : "";
  }
  const linhas: Escolhas["linhas"] = {};
  for (const l of p.linhas_invalidas) {
    const d = l.decisao;
    linhas[l.linha] = { ignorar: d?.tipo === "IGNORAR_LINHA", valor: d?.tipo === "CORRIGIR_LINHA" ? texto(d[l.campo]) : "" };
  }
  const conflitos: Escolhas["conflitos"] = {};
  for (const c of p.conflitos) {
    conflitos[chaveConflito(c.descricao, c.ncm)] = c.decisao?.tipo === "ESCOLHER_CONFLITO" ? texto(c.decisao.categoria) : "";
  }
  return { categorias, linhas, conflitos };
}

/** Conjunto COMPLETO de decisões (o motor substitui o anterior). Só inclui o que o operador de fato escolheu. */
export function montarDecisoes(p: ProblemasLote, e: Escolhas): Decisao[] {
  const saida: Decisao[] = [];
  for (const c of p.categorias) {
    const v = e.categorias[c.texto] ?? "";
    if (v === IGNORAR) saida.push({ tipo: "IGNORAR_CATEGORIA", texto: c.texto });
    else if (v.startsWith(PREFIXO_CAT)) saida.push({ tipo: "MAPEAR_CATEGORIA", texto: c.texto, categoria: v.slice(PREFIXO_CAT.length) });
  }
  for (const l of p.linhas_invalidas) {
    const esc = e.linhas[l.linha];
    if (!esc) continue;
    if (esc.ignorar) saida.push({ tipo: "IGNORAR_LINHA", linha: l.linha });
    else if (esc.valor.trim()) saida.push({ tipo: "CORRIGIR_LINHA", linha: l.linha, [l.campo]: esc.valor.trim() });
  }
  for (const c of p.conflitos) {
    const v = e.conflitos[chaveConflito(c.descricao, c.ncm)] ?? "";
    if (v) saida.push({ tipo: "ESCOLHER_CONFLITO", descricao: c.descricao, ncm: c.ncm, categoria: v });
  }
  return saida;
}

/** Quantos problemas listados já têm uma escolha (não quer dizer resolvido: quem confirma é o motor ao reavaliar). */
export function contarEscolhidos(p: ProblemasLote, e: Escolhas): number {
  return montarDecisoes(p, e).length;
}

/** O envio do BFF aceita até 500 decisões (teto do corpo JSON); acima disso o operador usa a planilha dos problemas. */
export const MAX_DECISOES = 500;
