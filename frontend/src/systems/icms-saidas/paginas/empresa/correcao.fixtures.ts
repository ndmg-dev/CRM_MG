// Problemas de um lote BLOQUEADO corrigível (formato de GET .../problemas do motor): fixture dos testes da correção da importação.
import type { ProblemasLote } from "../../tipos";

export const PROBLEMAS: ProblemasLote = {
  status: "BLOQUEADO",
  corrigivel: true,
  pendentes: { linhas_invalidas: 2, categorias: 2, categorias_linhas: 2, conflitos: 1, total: 5 },
  bloqueios: ["2 linha(s) com dados inválidos"],
  categorias_validas: ["NORMAL", "ST"],
  linhas_invalidas: [
    { linha: 6, campo: "descricao", motivo: "DESCRIÇÃO vazia", descricao: "", ncm: "39173900", icms: "NORMAL", pis_cofins: "", referencia: "5", resolvido: false, decisao: null },
    { linha: 7, campo: "ncm", motivo: "NCM vazio, zerado ou inválido ('0')", descricao: "PRODUTO 6", ncm: "0", icms: "NORMAL", pis_cofins: "", referencia: null, resolvido: false, decisao: null },
  ],
  total_linhas_invalidas: 2,
  categorias: [
    { texto: "ST - MONO", texto_exemplo: "ST - MONO", ocorrencias: 1, exemplos: [{ linha: 4, descricao: "PRODUTO 3", ncm: "39173900" }], resolvido: false, decisao: null },
    { texto: "RBC 70,59%", texto_exemplo: "RBC 70,59%", ocorrencias: 1, exemplos: [{ linha: 5, descricao: "PRODUTO 4", ncm: "39173900" }], resolvido: false, decisao: null },
  ],
  conflitos: [
    {
      descricao: "PRODUTO 7",
      ncm: "39173900",
      opcoes: [
        { categoria: "NORMAL", linhas: [8] },
        { categoria: "ST", linhas: [9] },
      ],
      resolvido: false,
      decisao: null,
    },
  ],
  total_conflitos: 1,
  correcoes: [],
};
