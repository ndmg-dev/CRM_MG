// Formatos devolvidos pelo motor (docs/motor/openapi.json) e pelo BFF.

export interface PainelItem {
  empresa: string;
  razao_social: string;
  situacao: string;
  apuracao_id: string | null;
  od: number | null;
  ed: number | null;
  /** `totais.pendencias` da apuração vigente da competência (null sem apuração). */
  pendencias: Pendencias | null;
  /** Pendências ABERTAS da empresa hoje (independe da competência). */
  pendencias_abertas: number;
}

/** Contagens por origem que o motor grava em `totais.pendencias`. */
export interface Pendencias {
  produtos_sem_cadastro?: number;
  itens_sem_cadastro?: number;
  itens_cfop_nao_parametrizado?: number;
  itens_conferencia_manual?: number;
}

export interface Empresa {
  codigo: string;
  razao_social: string;
  cnpj: string | null;
  ativo: boolean;
  memoria_rev: number;
  criado_em: string;
}

export interface Totais {
  od?: number;
  ed?: number;
  saldo?: number;
  pendencias?: Pendencias;
}

export interface Apuracao {
  id: string;
  empresa: string;
  competencia: string;
  status: string;
  vigente: boolean;
  origem: string;
  arquivo_entrada_nome: string | null;
  n_itens: number | null;
  totais: Totais | null;
  erro: string | null;
  solicitado_por: string;
  iniciado_em: string;
  concluido_em: string | null;
  planilha_url: string | null;
  /** Versão das regras fiscais usada no cálculo (ausente em apurações antigas). */
  regras_versao?: number | null;
}

export interface Pendencia {
  id: number;
  /** Descrição normalizada: com o NCM, é a chave do item (não há código de produto). */
  descricao: string;
  ncm: string;
  cfop_exemplo: number | null;
  ocorrencias: number;
  valor_total: number;
  status: string;
  tributacao_definida: string | null;
  resolvido_por: string | null;
  resolvido_em: string | null;
  criado_em: string;
  /** Só com `?sugestoes=true` (pendências abertas): até 3 itens da memória na mesma NCM (ADR-010 do motor). */
  sugestoes?: SugestaoPendencia[] | null;
  /** Sugestão IDENTICA e consistente: a única elegível ao aceite em lote. Nunca PARECIDO. */
  sugestao_aceitavel?: SugestaoPendencia | null;
}

export interface SugestaoPendencia {
  item_id: number;
  descricao: string;
  /** Tributação (categoria) do item sugerido. */
  icms: string;
  /** IDENTICO = igual ignorando maiúsculas, acentos e espaços; PARECIDO = texto semelhante (conferir). */
  nivel: "IDENTICO" | "PARECIDO";
  similaridade: number;
}

/** GET .../pendencias/resumo-sugestoes: panorama de TODAS as pendências abertas (não só da página). */
export interface ResumoSugestoes {
  abertas: number;
  /** O que "Aceitar as idênticas" resolveria agora. */
  identicas_aceitaveis: number;
  /** Há item idêntico, mas as idênticas têm tributações diferentes: o operador escolhe. */
  identicas_ambiguas: number;
  parecidas: number;
  sem_sugestao: number;
}

/** Resposta de resolver-lote. Item que já estava na memória é MANTIDO (a menos que `sobrescrever`). */
export interface ResultadoResolucao {
  resolvidas: number;
  adicionadas: number;
  sobrescritas: number;
  mantidas: number;
  ja_tratadas: number;
  lote_id: string | null;
}

export interface ResultadoAceite extends ResultadoResolucao {
  encontradas: number;
  /** Aceitáveis que ficaram para uma próxima chamada (limite por lote do motor). */
  restantes: number;
}

/** GET .../pendencias/previa-sugestoes: o que aceitar a sugestão resolveria com um mínimo de semelhança (sem gravar). */
export interface PreviaSugestoes {
  abertas: number;
  aceitaveis: number;
  identicas: number;
  parecidas: number;
  ficam_para_conferir: number;
}

export interface ResultadoAceiteSugestoes extends ResultadoAceite {
  /** Das enviadas nesta chamada, quantas tinham sugestão idêntica / parecida. */
  identicas: number;
  parecidas: number;
}

/** Descrição que já existe na memória com tributação diferente da do mesmo código (completar a memória). */
export interface Divergencia {
  codigo: string | null;
  ncm: string;
  descricao: string;
  icms_pela_descricao: string;
  icms_pelo_codigo: string;
}

export interface ResultadoCompletar {
  /** Lote gerado para revisar e aprovar; null se não havia nada a carregar. */
  lote: Lote | null;
  relatorio: Record<string, number>;
  divergencias: Divergencia[];
  total_divergencias: number;
}

/** Regras fiscais globais do motor (GET /regras, ADR-007): só o que o painel lê. */
export interface Regras {
  versao: number;
  versao_atual: number;
  competencia: string | null;
  conteudo: {
    categorias?: { nome: string; grupo: string }[];
    aliases?: { texto: string; categoria: string }[];
    [outro: string]: unknown;
  };
}

export interface ResumoLote {
  itens_arquivo?: number;
  incluidos?: number;
  removidos?: number;
  tributacao_alterada?: number;
  percentual_removidos?: number;
  percentual_chaves_em_comum?: number;
  requer_confirmacao_remocoes?: boolean;
  /** Itens da memória usada na comparação (base do percentual de remoção). */
  itens_memoria_atual?: number;
  /** Limite de remoção sem confirmação (fração; hoje 0,05). Decidido pelo motor. */
  limite_remocao?: number;
  /** Depois da aprovação item a item. */
  aplicadas?: number;
  nao_aplicadas?: number;
  /** true = lote sem vigência (correção de cadastro, vale para todos os meses). */
  correcao?: boolean;
  /** Lote BLOQUEADO com problemas que o operador resolve na tela (linha inválida, categoria desconhecida, conflito). */
  corrigivel?: boolean;
  /** Problemas ainda pendentes (o motor reavalia a cada decisão gravada). */
  problemas?: { linhas_invalidas: number; categorias: number; categorias_linhas: number; conflitos: number; total: number };
  correcoes?: { decisoes: number; linhas_ignoradas: number; linhas_mapeadas: number; linhas_corrigidas: number; conflitos_resolvidos: number; sem_efeito: number };
}

/** Decisão do operador sobre um problema da importação (conjunto completo vai em PUT .../correcoes). */
export type Decisao =
  | { tipo: "MAPEAR_CATEGORIA"; texto: string; categoria: string }
  | { tipo: "IGNORAR_CATEGORIA"; texto: string }
  | { tipo: "CORRIGIR_LINHA"; linha: number; descricao?: string; ncm?: string; icms?: string; pis_cofins?: string }
  | { tipo: "IGNORAR_LINHA"; linha: number }
  | { tipo: "ESCOLHER_CONFLITO"; descricao: string; ncm: string; categoria: string };

/** Decisão como o motor devolve (com quem e quando): não é reenviada como está. */
export type DecisaoGravada = Record<string, unknown> & { tipo: Decisao["tipo"] };

export interface ProblemaLinha {
  linha: number;
  /** O que falta/está inválido: descricao | ncm | icms. */
  campo: "descricao" | "ncm" | "icms";
  motivo: string;
  descricao: string;
  ncm: string;
  icms: string;
  pis_cofins: string;
  /** Código ITEM do arquivo (o motor não usa): só para reconhecer o produto. */
  referencia: string | null;
  resolvido: boolean;
  decisao: DecisaoGravada | null;
}

export interface ProblemaCategoria {
  /** Grafia normalizada: é o `texto` das decisões. */
  texto: string;
  texto_exemplo: string;
  ocorrencias: number;
  exemplos: { linha: number; descricao: string; ncm: string }[];
  resolvido: boolean;
  decisao: DecisaoGravada | null;
}

export interface ProblemaConflito {
  descricao: string;
  ncm: string;
  opcoes: { categoria: string; linhas: number[] }[];
  resolvido: boolean;
  decisao: DecisaoGravada | null;
}

export interface ProblemasLote {
  status: string;
  corrigivel: boolean;
  pendentes: { linhas_invalidas: number; categorias: number; categorias_linhas: number; conflitos: number; total: number };
  bloqueios: string[];
  /** Categorias que existem nas regras para este lote: destino do mapeamento. */
  categorias_validas: string[];
  linhas_invalidas: ProblemaLinha[];
  total_linhas_invalidas: number;
  categorias: ProblemaCategoria[];
  conflitos: ProblemaConflito[];
  total_conflitos: number;
  correcoes: DecisaoGravada[];
}

export interface Lote {
  id: string;
  tipo: string;
  status: string;
  vigencia_inicio: string;
  arquivo_nome: string | null;
  enviado_por: string;
  decidido_por: string | null;
  decidido_em: string | null;
  motivo: string | null;
  resumo: ResumoLote;
  bloqueios: string[];
  avisos: string[];
  criado_em: string;
}

export interface Diferenca {
  /** Chave da seleção na aprovação item a item (`diferencas` / `excluir`). */
  id: number;
  /** INCLUÍDO | REMOVIDO | TRIBUTAÇÃO ALTERADA (mudar a descrição ou o NCM = REMOVIDO + INCLUÍDO). */
  tipo: string;
  /** ID do item na memória da empresa; INCLUÍDO só recebe ao ser aplicado. */
  item_id: number | null;
  /** Descrição normalizada: com o NCM, é a chave do item. */
  descricao: string;
  ncm: string;
  icms_anterior: string | null;
  icms_novo: string | null;
  pis_anterior: string | null;
  pis_novo: string | null;
  /** null = lote não decidido; true/false = entrou ou não na memória. */
  aplicada: boolean | null;
}

export interface ItemMemoria {
  /** ID do item: sequencial por empresa, gerado pelo motor. */
  item_id: number;
  descricao: string;
  ncm: string;
  icms: string;
  pis_cofins: string;
  vigencia_inicio: string;
}

// ---------------------------------------------------------------- regras fiscais (tela "Regras", CONTRATO_API_REGRAS)

export type ModoGrupo = "PERCENTUAL" | "ST" | "SO_ENTRADA";
export type TratamentoCfop = "VENDA" | "DEVOLUÇÃO" | "CONFORME DESTAQUE";

/** Grupo de cálculo. RBC e alíquotas são FRAÇÕES (0,4293 = 42,93%), só em PERCENTUAL; nos outros modos, null. */
export interface GrupoRegra {
  nome: string;
  modo: ModoGrupo;
  rbc_interna: number | null;
  aliq_interna: number | null;
  rbc_interestadual: number | null;
  aliq_interestadual: number | null;
  cst_esperados: string[];
}

export interface CategoriaRegra {
  nome: string;
  grupo: string;
}

export interface AliasRegra {
  texto: string;
  categoria: string;
}

export interface CfopRegra {
  /** Texto de 4 dígitos. */
  cfop: string;
  tratamento: TratamentoCfop;
  descricao: string;
}

export interface ParametrosRegra {
  /** Em R$. */
  tolerancia: number;
  /** Em % (0 a 100), não fração. */
  aliquotas_validas: number[];
  base_legal_st_interestadual: string;
}

export interface ConteudoRegras {
  grupos: GrupoRegra[];
  categorias: CategoriaRegra[];
  aliases: AliasRegra[];
  cfops: CfopRegra[];
  parametros: ParametrosRegra;
}

export type TabelaRegras = "grupos" | "categorias" | "aliases" | "cfops";

export interface DiferencasTabela<T = Record<string, unknown>> {
  novos: T[];
  alterados: { chave: string; campos: string[]; antes: T; depois: T }[];
  removidos: T[];
}

export interface DiferencasRegras {
  grupos?: DiferencasTabela;
  categorias?: DiferencasTabela;
  aliases?: DiferencasTabela;
  cfops?: DiferencasTabela;
  parametros?: { alterados: { chave: string; antes: unknown; depois: unknown }[] };
}

/** GET/PUT /regras/rascunho: sem rascunho salvo, `existe=false` e o conteúdo são as regras atuais. */
export interface RascunhoRegras {
  existe: boolean;
  versao_atual: number;
  base_versao: number;
  /** Outra publicação depois do rascunho: só dá para descartar e refazer. */
  desatualizado: boolean;
  alterado_por: string | null;
  atualizado_em: string | null;
  conteudo: ConteudoRegras;
  diferencas: DiferencasRegras;
  n_alteracoes: number;
  /** Não vazio ⇒ não publica. */
  bloqueios: string[];
  /** Não vazio ⇒ publicar exige `confirmar_impacto: true`. */
  requer_confirmacao: string[];
}

export interface VersaoRegrasResumo {
  numero: number;
  tipo: "INICIAL" | "CORRECAO" | "MUDANCA";
  vigencia_inicio: string | null;
  resumo: string;
  publicado_por: string;
  criado_em: string;
  n_alteracoes: number;
}

export interface VersaoRegras extends VersaoRegrasResumo {
  diferencas: DiferencasRegras;
  conteudo: ConteudoRegras;
  periodos: { inicio: string; fim: string | null; versao: number }[];
}

/** Auditoria das regras (GET /regras/historico). */
export interface EventoRegras {
  id: number;
  quando: string;
  ator: string;
  ator_externo: string | null;
  acao: string;
  alvo: string | null;
  detalhes: Record<string, unknown>;
}
