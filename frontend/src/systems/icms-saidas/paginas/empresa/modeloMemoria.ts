// Planilha-modelo da memória tributária: aba MEMÓRIA (cabeçalho + exemplos) e aba INSTRUÇÕES (cada campo explicado).
// Formato de 4 colunas do motor (ADR-007/008, docs/CONTRATO_API_REGRAS.md §5): a chave do item é DESCRIÇÃO + NCM.
// As regras de leitura seguem motor-calculos, app/engine/leitura.py › ler_memoria.
import { apelidosDasRegras, categoriasDasRegras } from "../../componentes/regras";
import type { Regras } from "../../tipos";
import { gerarXlsx, type Celula } from "../../xlsx";
import { AJUDA } from "../../ui/textosAjuda";

export const NOME_MODELO_MEMORIA = "modelo_memoria.xlsx";
export const CABECALHO_MEMORIA = ["DESCRIÇÃO", "NCM", "ICMS", "PIS COFINS"];

const EXEMPLOS: [string, string][] = [
  ["PARAFUSO SEXTAVADO 1/4 ZINCADO", "73181500"],
  ["JOELHO PVC 90 25MM", "39174090"],
  ["BLOCO CONCRETO 14X19X39", "68101100"],
  ["CIMENTO CP II 50KG", "25232910"],
  ["TINTA ACRILICA FOSCA 18L", "32091010"],
  ["TORNEIRA METAL CROMADA 1/2", "84818019"],
  ["CAPACETE DE SEGURANCA", "65061000"],
  ["BETONEIRA 400L", "84743100"],
];

export function abasModeloMemoria(regras: Regras | null | undefined) {
  const categorias = categoriasDasRegras(regras);
  const apelidos = apelidosDasRegras(regras);
  const nomes = categorias.map((c) => c.nome);

  // Um exemplo por categoria (até 8), para mostrar o texto exato que vai em ICMS.
  const exemplos: Celula[][] = EXEMPLOS.slice(0, Math.max(1, Math.min(nomes.length, EXEMPLOS.length))).map(([descricao, ncm], i) => [
    `EXEMPLO ${descricao}`,
    ncm,
    nomes[i] ?? "",
    "",
  ]);

  const exemploIcms = nomes[0] ?? "ST";
  const versao = regras ? `Regras fiscais v${regras.versao}` : "Regras fiscais";
  const instrucoes: Celula[][] = [
    ["Campo", "Obrigatório", "Formato", "Exemplo", "Como preencher"],
    [
      "DESCRIÇÃO",
      "Sim",
      "Texto (até 200 caracteres)",
      "PARAFUSO SEXTAVADO 1/4 ZINCADO",
      "Igual à descrição do produto no relatório de vendas: o motor cruza as vendas com a memória por DESCRIÇÃO + NCM. Maiúsculas e espaços repetidos não importam (o motor normaliza). Mudar a descrição de um item existente aparece no lote como um removido e um novo.",
    ],
    [
      "NCM",
      "Sim",
      "8 dígitos, só números",
      "73181500",
      "Digite só os números: com pontos (7318.15.00) o NCM é lido errado. A coluna já está formatada como texto para manter os zeros à esquerda; com menos de 8 dígitos o motor completa com zeros à esquerda. NCM vazio ou zerado bloqueia o lote.",
    ],
    [
      "ICMS",
      "Sim",
      "Uma das categorias abaixo (ou um apelido)",
      exemploIcms,
      "Define como o item é tributado no cálculo de OD e ED. O motor aceita a grafia sem diferença de maiúsculas e os apelidos listados abaixo, e grava o nome oficial. Categoria fora das regras bloqueia o lote.",
    ],
    [
      "PIS COFINS",
      "Não",
      "Texto livre (até 60 caracteres)",
      "",
      "Fica guardado na memória, mas não entra no cálculo do ICMS. Pode deixar em branco.",
    ],
    [],
    ["Regras gerais"],
    ["", "", "", "", "A primeira linha é o cabeçalho. A ordem das colunas é livre; colunas e abas a mais são ignoradas (só as 20 primeiras colunas são lidas)."],
    ["", "", "", "", "Colunas ITEM, CÓDIGO ou ID são ignoradas: o ID do item é gerado pelo motor. A planilha exportada traz o ID só para consulta."],
    ["", "", "", "", "O motor lê a aba MEMÓRIA (sem ela, a primeira aba com as colunas DESCRIÇÃO, NCM e ICMS). Apague as linhas de exemplo antes de enviar."],
    ["", "", "", "", `Tipo Parcial: ${AJUDA.parcial}`],
    ["", "", "", "", `Tipo Completa: ${AJUDA.completa}`],
    ["", "", "", "", "Também é aceito .csv (separado por ponto e vírgula, vírgula ou tabulação, em UTF-8) com o mesmo cabeçalho."],
    ["", "", "", "", "Nada é gravado no envio: o motor compara com a memória atual e o lote só vale depois de aprovado."],
    [],
    [`Categorias de ICMS aceitas (${versao})`, "Grupo de cálculo"],
    ...(categorias.length > 0
      ? categorias.map((c): Celula[] => [c.nome, c.grupo])
      : [["Não foi possível ler as categorias das regras fiscais; confira na tela de Pendências ou com um administrador."]]),
    ...(apelidos.length > 0
      ? [[] as Celula[], ["Apelidos aceitos na coluna ICMS", "Vira a categoria"] as Celula[], ...apelidos.map((a): Celula[] => [a.texto, a.categoria])]
      : []),
  ];
  const titulos = instrucoes
    .map((l, i) => (l[0] === "Regras gerais" || String(l[0]).startsWith("Categorias de ICMS") || l[0] === "Apelidos aceitos na coluna ICMS" ? i : -1))
    .filter((i) => i >= 0);

  return [
    {
      nome: "MEMÓRIA",
      linhas: [CABECALHO_MEMORIA, ...exemplos],
      larguras: [44, 12, 26, 14],
      colunasTexto: [1],
    },
    {
      nome: "INSTRUÇÕES",
      linhas: instrucoes,
      larguras: [36, 18, 32, 32, 90],
      linhasNegrito: [0, ...titulos],
      quebrarTexto: true,
    },
  ];
}

export function planilhaModeloMemoria(regras: Regras | null | undefined): Blob {
  return new Blob([gerarXlsx(abasModeloMemoria(regras))], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
