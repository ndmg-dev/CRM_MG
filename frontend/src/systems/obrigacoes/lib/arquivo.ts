/**
 * Validação de arquivo enviado pelo cliente.
 *
 * O `file.type` do navegador vem do sistema operacional, que o deduz da
 * EXTENSÃO. Renomear `payload.exe` para `nota.pdf` já faz o browser anunciar
 * `application/pdf`. Por isso conferimos a assinatura real nos primeiros
 * bytes — é o que o plano chama de "validação de MIME real, não extensão".
 *
 * Isto não substitui as defesas do servidor (CHECK de mime na tabela,
 * allowed_mime_types no bucket, bucket privado sem URL pública). É a primeira
 * das camadas, não a única.
 */

export const TAMANHO_MAXIMO = 20 * 1024 * 1024 // 20 MB

export interface TipoPermitido {
  mime: string
  rotulo: string
  extensoes: string[]
}

export const TIPOS_PERMITIDOS: TipoPermitido[] = [
  { mime: 'application/pdf', rotulo: 'PDF', extensoes: ['.pdf'] },
  { mime: 'application/xml', rotulo: 'XML', extensoes: ['.xml'] },
  { mime: 'image/jpeg', rotulo: 'JPEG', extensoes: ['.jpg', '.jpeg'] },
  { mime: 'image/png', rotulo: 'PNG', extensoes: ['.png'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    rotulo: 'Excel (.xlsx)',
    extensoes: ['.xlsx'],
  },
]

export const ACCEPT = TIPOS_PERMITIDOS.flatMap((t) => t.extensoes).join(',')

const bytesIguais = (buf: Uint8Array, assinatura: number[], offset = 0): boolean =>
  assinatura.every((b, i) => buf[offset + i] === b)

/**
 * Detecta o tipo pelos bytes iniciais. Retorna null quando não reconhece —
 * e o não reconhecido é recusado, nunca aceito na dúvida.
 */
export async function detectarTipoReal(arquivo: File): Promise<string | null> {
  const buf = new Uint8Array(await arquivo.slice(0, 512).arrayBuffer())

  // %PDF
  if (bytesIguais(buf, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf'

  // PNG
  if (bytesIguais(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'

  // JPEG
  if (bytesIguais(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg'

  // ZIP (PK\x03\x04). .xlsx é um zip — sem inspecionar o conteúdo não dá para
  // distinguir de um .zip qualquer, então só aceitamos quando a extensão
  // declara .xlsx. Um zip renomeado para .xlsx ainda passaria aqui; o CHECK
  // de mime do banco e o allowed_mime_types do bucket seguram o resto.
  if (bytesIguais(buf, [0x50, 0x4b, 0x03, 0x04])) {
    return arquivo.name.toLowerCase().endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : null
  }

  // XML: pode ter BOM UTF-8 antes do prólogo.
  const inicio = new TextDecoder('utf-8')
    .decode(buf.slice(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0, 128))
    .trimStart()
  if (inicio.startsWith('<?xml') || /^<[A-Za-z_]/.test(inicio)) return 'application/xml'

  return null
}

export interface ResultadoValidacao {
  ok: boolean
  mime?: string
  erro?: string
}

export async function validarArquivo(arquivo: File): Promise<ResultadoValidacao> {
  if (arquivo.size === 0) {
    return { ok: false, erro: 'O arquivo está vazio.' }
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    const mb = (arquivo.size / 1024 / 1024).toFixed(1)
    return { ok: false, erro: `Arquivo de ${mb} MB — o limite é 20 MB.` }
  }
  if (arquivo.name.length > 255) {
    return { ok: false, erro: 'O nome do arquivo é longo demais.' }
  }

  const real = await detectarTipoReal(arquivo)
  if (!real) {
    return {
      ok: false,
      erro: 'Não reconhecemos o conteúdo deste arquivo. Envie PDF, XML, JPEG, PNG ou XLSX.',
    }
  }
  if (!TIPOS_PERMITIDOS.some((t) => t.mime === real)) {
    return { ok: false, erro: 'Tipo de arquivo não aceito.' }
  }

  // Extensão mentindo sobre o conteúdo é sinal de problema, não descuido.
  const ext = arquivo.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ''
  const esperado = TIPOS_PERMITIDOS.find((t) => t.mime === real)
  if (esperado && ext && !esperado.extensoes.includes(ext)) {
    return {
      ok: false,
      erro: `O conteúdo do arquivo é ${esperado.rotulo}, mas a extensão é ${ext}. Renomeie e envie de novo.`,
    }
  }

  return { ok: true, mime: real }
}

/**
 * Nome seguro para o storage. O nome original vai para a coluna do banco; o
 * caminho no bucket é sanitizado — barra, `..` ou caractere de controle no
 * nome viraria caminho inesperado no objeto.
 */
export function nomeSeguro(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove acentos
    .replace(/[^\w.\- ]/g, '_')         // barra, `..`, controle: tudo vira _
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120)
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
