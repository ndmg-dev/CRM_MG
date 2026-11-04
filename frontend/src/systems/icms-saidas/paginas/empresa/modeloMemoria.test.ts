import { describe, expect, it } from "vitest";

import { crc32, gerarXlsx } from "../../xlsx";
import type { Regras } from "../../tipos";
import { abasModeloMemoria, CABECALHO_MEMORIA } from "./modeloMemoria";

const REGRAS: Regras = {
  versao: 7,
  versao_atual: 7,
  competencia: null,
  conteudo: {
    categorias: [
      { nome: "ST", grupo: "ST" },
      { nome: "NORMAL", grupo: "NORMAL" },
      { nome: "RBC 42,93% / 73,33%", grupo: "ANEXO I" },
    ],
    aliases: [{ texto: "RBC 42,93%", categoria: "RBC 42,93% / 73,33%" }],
  },
};

/** Lê os arquivos de um zip sem compressão (o que o gerador produz). */
function deszipar(zip: Uint8Array): Map<string, string> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const arquivos = new Map<string, string>();
  const decodificador = new TextDecoder();
  let p = 0;
  while (dv.getUint32(p, true) === 0x04034b50) {
    const tamanho = dv.getUint32(p + 18, true);
    const nome = dv.getUint16(p + 26, true);
    const extra = dv.getUint16(p + 28, true);
    const inicio = p + 30 + nome + extra;
    const dados = zip.subarray(inicio, inicio + tamanho);
    expect(crc32(dados)).toBe(dv.getUint32(p + 14, true));
    arquivos.set(decodificador.decode(zip.subarray(p + 30, p + 30 + nome)), decodificador.decode(dados));
    p = inicio + tamanho;
  }
  return arquivos;
}

describe("gerador de xlsx", () => {
  it("calcula o CRC-32 padrão", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("monta o pacote com as abas, texto escapado e coluna em formato texto", () => {
    const arquivos = deszipar(
      gerarXlsx([{ nome: "MEMÓRIA", linhas: [["ITEM", "NCM"], [1, "00012345"], [2, "A & <B>"]], colunasTexto: [1], larguras: [8, 12] }]),
    );
    expect([...arquivos.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    expect(arquivos.get("xl/workbook.xml")).toContain('name="MEMÓRIA"');
    const folha = arquivos.get("xl/worksheets/sheet1.xml")!;
    expect(folha).toContain('<c r="A2"><v>1</v></c>');
    expect(folha).toContain("<t xml:space=\"preserve\">00012345</t>");
    expect(folha).toContain("A &amp; &lt;B&gt;");
    expect(folha).toContain('<col min="2" max="2" width="12" customWidth="1" style="3"/>');
  });
});

describe("planilha modelo da memória", () => {
  it("tem só as 4 colunas do motor (DESCRIÇÃO, NCM, ICMS, PIS COFINS) e um exemplo por categoria das regras", () => {
    const [memoria, instrucoes] = abasModeloMemoria(REGRAS);
    expect(memoria.nome).toBe("MEMÓRIA");
    expect(memoria.linhas[0]).toEqual(CABECALHO_MEMORIA);
    expect(CABECALHO_MEMORIA).toEqual(["DESCRIÇÃO", "NCM", "ICMS", "PIS COFINS"]);
    expect(memoria.linhas.slice(1).map((l) => l[2])).toEqual(["NORMAL", "RBC 42,93% / 73,33%", "ST"]);
    for (const linha of memoria.linhas.slice(1)) expect(String(linha[1])).toMatch(/^\d{8}$/);
    expect(memoria.colunasTexto).toEqual([1]); // NCM como texto (zeros à esquerda)

    expect(instrucoes.linhas.slice(1, 5).map((l) => l[0])).toEqual(["DESCRIÇÃO", "NCM", "ICMS", "PIS COFINS"]);
    expect(instrucoes.linhas.some((l) => l[0] === "ITEM")).toBe(false);
    expect(instrucoes.linhas).toContainEqual(["Categorias de ICMS aceitas (Regras fiscais v7)", "Grupo de cálculo"]);
    expect(instrucoes.linhas).toContainEqual(["RBC 42,93% / 73,33%", "ANEXO I"]);
    expect(instrucoes.linhas).toContainEqual(["RBC 42,93%", "RBC 42,93% / 73,33%"]);
  });

  it("sem regras: um exemplo e o aviso de que as categorias não foram lidas", () => {
    const [memoria, instrucoes] = abasModeloMemoria(null);
    expect(memoria.linhas).toHaveLength(2);
    expect(instrucoes.linhas.at(-1)?.[0]).toMatch(/Não foi possível ler as categorias/);
  });
});
