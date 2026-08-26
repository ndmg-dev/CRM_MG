import type { NFeItem, NFeParsed } from "../../hooks/queries";

export type { NFeItem, NFeParsed };

export interface ClassificationRow {
  ncm: string;
  descricao: string;
  tributacao: string;
  utilizacao: string;
  aliquota_interna: string;
  mva_original: string;
  mva_4: string;
  mva_7: string;
  mva_12: string;
  rbc: string;
  hasRule: boolean;
}

export function groupKey(ncm: string, descricao: string): string {
  return `${ncm}|${descricao}`;
}

/** Chave de classificação no wizard multi-nota: cada empresa tem sua própria
 * linha de classificação para o mesmo NCM, mesmo que o lote misture notas de
 * empresas diferentes (mantém a mesma isolação por empresa da memória — ver
 * README, "Memória de regras NCM"). */
export function classificationKey(companyId: number, ncm: string, descricao: string): string {
  return `${companyId}|${ncm}|${descricao}`;
}

/** Item elegível "carimbado" com a nota e a empresa de origem — necessário
 * quando o wizard processa várias notas ao mesmo tempo, para saber a quem
 * cada item pertence nas etapas de classificação e resultado. */
export interface TaggedItem extends NFeItem {
  chave_nfe: string;
  companyId: number;
}

/** Um grupo de contexto do wizard multi-nota: agrupa notas por
 * (CNPJ destinatário + competência) — igual ao sistema Django original
 * (`group_key_for_invoice`). Várias notas da mesma empresa na mesma
 * competência caem no mesmo grupo; destinatários ou competências diferentes
 * viram grupos separados. A competência de cada grupo vem das próprias notas
 * (não é um campo editável global do wizard). */
export interface InvoiceGroup {
  key: string; // `${cnpj}__${competencia}`
  cnpj: string;
  competencia: string; // YYYY-MM-01, derivado das notas do grupo
  invoices: NFeParsed[];
  companyId: number | null; // preenchido após "Salvar e Continuar" no Contexto
  existingCompany: boolean;
}

export function groupKeyForInvoice(cnpj: string, competencia: string): string {
  return `${cnpj}__${competencia}`;
}

export const DEFAULT_CLASSIFICATION: Omit<ClassificationRow, "ncm" | "descricao"> = {
  tributacao: "normal",
  utilizacao: "revenda",
  aliquota_interna: "0.2050",
  mva_original: "0",
  mva_4: "0",
  mva_7: "0",
  mva_12: "0",
  rbc: "0.8000",
  hasRule: false,
};
