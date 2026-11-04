// Gerador mínimo de .xlsx no navegador (sem dependência): zip sem compressão + SpreadsheetML.
// Só o necessário para planilhas-modelo: texto, número, cabeçalho em negrito, larguras e coluna em formato texto.

export type Celula = string | number | null;

export interface Aba {
  nome: string;
  linhas: Celula[][];
  /** Largura de cada coluna, em caracteres. */
  larguras?: number[];
  /** Colunas (índice 0) formatadas como texto, para o Excel não comer zeros à esquerda do que for digitado. */
  colunasTexto?: number[];
  /** Linhas (índice 0) em negrito; o padrão é só a primeira. */
  linhasNegrito?: number[];
  /** Quebra o texto das células (para colunas de explicação). */
  quebrarTexto?: boolean;
}

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of dados) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Zip "stored" (método 0): suficiente para arquivos pequenos e lido por Excel, LibreOffice e openpyxl. */
export function zipar(arquivos: { nome: string; conteudo: string }[]): Uint8Array<ArrayBuffer> {
  const codificador = new TextEncoder();
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let deslocamento = 0;
  const DATA_DOS = 0x0021; // 01/01/1980

  for (const arquivo of arquivos) {
    const nome = codificador.encode(arquivo.nome);
    const dados = codificador.encode(arquivo.conteudo);
    const crc = crc32(dados);

    const local = new Uint8Array(30 + nome.length + dados.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true); // nomes em UTF-8
    l.setUint16(12, DATA_DOS, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, dados.length, true);
    l.setUint32(22, dados.length, true);
    l.setUint16(26, nome.length, true);
    local.set(nome, 30);
    local.set(dados, 30 + nome.length);

    const central = new Uint8Array(46 + nome.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(14, DATA_DOS, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, dados.length, true);
    c.setUint32(24, dados.length, true);
    c.setUint16(28, nome.length, true);
    c.setUint32(42, deslocamento, true);
    central.set(nome, 46);

    locais.push(local);
    centrais.push(central);
    deslocamento += local.length;
  }

  const tamanhoCentral = centrais.reduce((soma, c) => soma + c.length, 0);
  const fim = new Uint8Array(22);
  const f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, arquivos.length, true);
  f.setUint16(10, arquivos.length, true);
  f.setUint32(12, tamanhoCentral, true);
  f.setUint32(16, deslocamento, true);

  const saida = new Uint8Array(deslocamento + tamanhoCentral + fim.length);
  let p = 0;
  for (const parte of [...locais, ...centrais, fim]) {
    saida.set(parte, p);
    p += parte.length;
  }
  return saida;
}

function escapar(texto: string): string {
  return texto
    // eslint-disable-next-line no-control-regex -- remove de propósito os caracteres de controle que o XML do Excel não aceita
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function letraColuna(indice: number): string {
  let letra = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  return letra;
}

// Estilos (cellXfs): 0 normal, 1 negrito, 2 texto quebrado no topo, 3 formato texto ("@"), 4 negrito quebrado.
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function planilha(aba: Aba): string {
  const negrito = new Set(aba.linhasNegrito ?? [0]);
  const texto = new Set(aba.colunasTexto ?? []);
  const colunas = (aba.larguras ?? [])
    .map((largura, i) => `<col min="${i + 1}" max="${i + 1}" width="${largura}" customWidth="1"${texto.has(i) ? ' style="3"' : ""}/>`)
    .join("");
  const linhas = aba.linhas
    .map((linha, r) => {
      const celulas = linha
        .map((valor, c) => {
          if (valor === null || valor === "") return "";
          const ref = `${letraColuna(c)}${r + 1}`;
          const estilo = negrito.has(r) ? (aba.quebrarTexto ? 4 : 1) : texto.has(c) ? 3 : aba.quebrarTexto ? 2 : 0;
          const s = estilo ? ` s="${estilo}"` : "";
          if (typeof valor === "number") return `<c r="${ref}"${s}><v>${valor}</v></c>`;
          return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${celulas}</row>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    (colunas ? `<cols>${colunas}</cols>` : "") +
    `<sheetData>${linhas}</sheetData></worksheet>`
  );
}

export function gerarXlsx(abas: Aba[]): Uint8Array<ArrayBuffer> {
  const tipos = abas
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("");
  const folhas = abas.map((aba, i) => `<sheet name="${escapar(aba.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  const relacoes = abas
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;

  return zipar([
    {
      nome: "[Content_Types].xml",
      conteudo:
        `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `${tipos}</Types>`,
    },
    {
      nome: "_rels/.rels",
      conteudo:
        `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      nome: "xl/workbook.xml",
      conteudo:
        `${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${folhas}</sheets></workbook>`,
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      conteudo:
        `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relacoes}` +
        `<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    { nome: "xl/styles.xml", conteudo: ESTILOS },
    ...abas.map((aba, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, conteudo: planilha(aba) })),
  ]);
}
