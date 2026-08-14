// Testes da validação de arquivo do portal.
//
//   node --test src/systems/obrigacoes/lib/arquivo.test.mjs
//
// O caso que importa é o do arquivo que MENTE: extensão e `file.type` dizem
// uma coisa, os bytes dizem outra. É o que a validação por extensão deixaria
// passar.

import test from 'node:test'
import assert from 'node:assert/strict'
import { detectarTipoReal, nomeSeguro, validarArquivo } from './arquivo.ts'

const arquivo = (nome, bytes, tipoDeclarado = '') =>
  new File([new Uint8Array(bytes)], nome, { type: tipoDeclarado })

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]
const ZIP = [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0] // MZ, executável Windows
const XML = [...Buffer.from('<?xml version="1.0"?><nfe/>')]

test('reconhece os tipos aceitos pelos bytes iniciais', async () => {
  assert.equal(await detectarTipoReal(arquivo('a.pdf', PDF)), 'application/pdf')
  assert.equal(await detectarTipoReal(arquivo('a.png', PNG)), 'image/png')
  assert.equal(await detectarTipoReal(arquivo('a.jpg', JPEG)), 'image/jpeg')
  assert.equal(await detectarTipoReal(arquivo('a.xml', XML)), 'application/xml')
})

test('XML com BOM UTF-8 ainda é reconhecido', async () => {
  const comBom = [0xef, 0xbb, 0xbf, ...XML]
  assert.equal(await detectarTipoReal(arquivo('a.xml', comBom)), 'application/xml')
})

test('executável renomeado para .pdf é recusado', async () => {
  // O navegador anunciaria application/pdf: `file.type` vem da extensão.
  const disfarcado = arquivo('nota-fiscal.pdf', EXE, 'application/pdf')
  assert.equal(await detectarTipoReal(disfarcado), null)

  const r = await validarArquivo(disfarcado)
  assert.equal(r.ok, false)
  assert.match(r.erro, /não reconhecemos/i)
})

test('zip só passa quando a extensão declara .xlsx', async () => {
  assert.equal(await detectarTipoReal(arquivo('planilha.xlsx', ZIP)),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  assert.equal(await detectarTipoReal(arquivo('arquivos.zip', ZIP)), null)
})

test('conteúdo válido mas com extensão trocada é recusado', async () => {
  // PDF de verdade nomeado .png: ou é engano, ou é tentativa. Nos dois casos
  // vale pedir para renomear em vez de aceitar calado.
  const r = await validarArquivo(arquivo('doc.png', PDF))
  assert.equal(r.ok, false)
  assert.match(r.erro, /extensão/i)
})

test('arquivo aceito devolve o mime real, não o declarado', async () => {
  const r = await validarArquivo(arquivo('nota.pdf', PDF, 'text/plain'))
  assert.equal(r.ok, true)
  assert.equal(r.mime, 'application/pdf')
})

test('arquivo vazio é recusado', async () => {
  const r = await validarArquivo(new File([], 'vazio.pdf'))
  assert.equal(r.ok, false)
  assert.match(r.erro, /vazio/i)
})

test('arquivo acima de 20 MB é recusado', async () => {
  const grande = new File([new Uint8Array(21 * 1024 * 1024)], 'g.pdf')
  const r = await validarArquivo(grande)
  assert.equal(r.ok, false)
  assert.match(r.erro, /limite é 20 MB/i)
})

test('nomeSeguro neutraliza travessia de caminho', () => {
  assert.equal(nomeSeguro('../../etc/passwd'), '._._etc_passwd')
  assert.ok(!nomeSeguro('a/b/c.pdf').includes('/'))
  assert.ok(!nomeSeguro('..\\..\\win.ini').includes('\\'))
})

test('nomeSeguro preserva o nome legível e remove acentos', () => {
  assert.equal(nomeSeguro('Nota Fiscal Março.pdf'), 'Nota_Fiscal_Marco.pdf')
})

test('nomeSeguro limita o comprimento', () => {
  assert.ok(nomeSeguro('a'.repeat(400) + '.pdf').length <= 120)
})
