/** Tipos do dataset.json emitido pelo ETL (esquema estrela — spec §5.1). */

/**
 * 🔴 Segmento de negócio da unidade. Substituiu o par `tipo`/`grupo`, que
 * modelava uma hierarquia entre abas que os dados não sustentam — ver
 * `etl/empresas.yaml` para a prova e o histórico do erro.
 */
export type Segmento = "varejo" | "atacado";
export type TipoConta = "TT" | "NN";
export type GrupoDre =
  | "receita"
  | "deducao"
  | "custo"
  | "despesa_op"
  | "desp_fin"
  | "outras"
  | "resultado";

export interface Empresa {
  id: number;
  codigo: string;
  /**
   * Identidade estável da empresa, definida em `etl/empresas.yaml`.
   * Sobrevive a renomeação de aba — é a chave usada para amarrar anotações.
   */
  slug: string;
  razao_social: string | null;
  segmento: Segmento;
  ativo: boolean;
  tem_dados: boolean;
}

export interface Conta {
  id: number;
  classificacao: string;
  conta: string;
  descricao: string;
  nivel: number;
  tipo: TipoConta;
  grupo_dre: GrupoDre;
  classificacao_pai: string | null;
  conta_pai_id: number | null;
}

export interface Periodo {
  id: number;
  ano: number;
  mes: number;
  trimestre: number;
  data: string;
}

export interface Fato {
  empresa_id: number;
  conta_id: number;
  periodo_id: number;
  valor: number;
}

export interface Meta {
  ano: number;
  meses: number[];
  colunas_lidas: string;
  abas_com_dados: string[];
  tolerancia_validacao: number;
  divergencias: number;
  gerado_em: string;
  arquivo_origem: string;
  sha256_origem: string;
}

export interface Dataset {
  meta: Meta;
  dim_empresa: Empresa[];
  dim_conta: Conta[];
  dim_periodo: Periodo[];
  fato_dre: Fato[];
}

/**
 * Escopo de análise (spec §7.1).
 *
 * 🔴 Estrutura real: as abas são unidades IRMÃS — nenhuma contém outra. O que
 * as separa é o segmento (varejo/atacado). Ver `etl/empresas.yaml`.
 *
 * - `grupo_total`  = todas as unidades com dados
 * - `soma_lojas`   = as unidades de varejo
 * - `empresa`      = uma aba específica
 *
 * O nome `soma_lojas` é legado e foi mantido de propósito: ele vira slug de
 * anotação de insight, e trocar um slug em uso orfana o que já foi gravado.
 */
export type Escopo =
  | { tipo: "empresa"; codigo: string }
  | { tipo: "soma_lojas" }
  | { tipo: "grupo_total" };
