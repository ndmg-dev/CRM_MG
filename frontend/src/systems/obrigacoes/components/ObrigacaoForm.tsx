import { useState } from 'react'
import { Button, Modal } from '@mg/ui'
import { Campo, SelectNativo } from './Campo'
import { classesInput } from '../lib/estilos'
import { useCriarObrigacao } from '../hooks/useCadastros'
import { UFS, temErro, validarObrigacao } from '../lib/validacao'
import type { DadosObrigacao, ErrosFormulario } from '../lib/validacao'
import { ROTULO_DEPARTAMENTO, ROTULO_PERIODICIDADE } from '../lib/formato'

const HOJE = new Date().toISOString().slice(0, 10)

const VAZIO: DadosObrigacao = {
  codigo: '', nome: '', descricao: '', departamento: '', esfera: 'FEDERAL',
  periodicidade: 'MENSAL', uf: '', codigo_municipio: '',
  tipo_dia: 'CORRIDO', dia_base: '', referencia: 'MES_SEGUINTE',
  ajuste: 'ANTECIPA', sabado_e_util: false, vigencia_inicio: HOJE,
}

const ESFERAS = [
  { valor: 'FEDERAL', rotulo: 'Federal' },
  { valor: 'ESTADUAL', rotulo: 'Estadual' },
  { valor: 'MUNICIPAL', rotulo: 'Municipal' },
  { valor: 'INTERNA', rotulo: 'Interna (não é obrigação de fisco)' },
]

const REFERENCIAS = [
  { valor: 'MES_COMPETENCIA', rotulo: 'No próprio mês da competência' },
  { valor: 'MES_SEGUINTE', rotulo: 'No mês seguinte' },
  { valor: 'SEGUNDO_MES_SEGUINTE', rotulo: 'No segundo mês seguinte' },
]

const AJUSTES = [
  { valor: 'ANTECIPA', rotulo: 'Antecipa para o dia útil anterior' },
  { valor: 'POSTERGA', rotulo: 'Posterga para o próximo dia útil' },
  { valor: 'NENHUM', rotulo: 'Mantém a data, mesmo em dia não útil' },
]

/**
 * Cadastro de obrigação do catálogo — por TIPO, nunca por empresa.
 *
 * A primeira versão da regra de prazo nasce junto: obrigação sem regra
 * vigente é ignorada pelo job mensal e nunca geraria entrega nenhuma.
 */
// O pai monta este componente só quando abre (`{aberto && <ObrigacaoForm/>}`),
// então o estado já nasce limpo — sem `useEffect` + `setState` para resetar,
// que dispararia render em cascata.
export function ObrigacaoForm({ onFechar }: { onFechar: () => void }) {
  const [dados, setDados] = useState<DadosObrigacao>(VAZIO)
  const [erros, setErros] = useState<ErrosFormulario>({})
  const [enviado, setEnviado] = useState(false)
  const criar = useCriarObrigacao()

  const alterar = <K extends keyof DadosObrigacao>(campo: K, valor: DadosObrigacao[K]) => {
    const novos = { ...dados, [campo]: valor }
    // Trocar a esfera limpa o escopo geográfico: o schema exige coerência, e
    // deixar uma UF órfã de uma escolha anterior faria o insert falhar.
    if (campo === 'esfera') {
      if (valor !== 'ESTADUAL') novos.uf = ''
      if (valor !== 'MUNICIPAL') novos.codigo_municipio = ''
    }
    setDados(novos)
    if (enviado) setErros(validarObrigacao(novos, true))
  }

  const salvar = async () => {
    const e = validarObrigacao(dados, true)
    setErros(e)
    setEnviado(true)
    if (temErro(e)) return
    try {
      await criar.mutateAsync(dados)
      onFechar()
    } catch { /* mensagem exibida abaixo */ }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => { if (!o) onFechar() }}
      title="Nova obrigação"
      description="Cadastro do catálogo mestre, por tipo de obrigação — não por empresa."
      actions={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={criar.isPending}>Cancelar</Button>
          <Button onClick={salvar} disabled={criar.isPending}>
            {criar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Código" erro={erros.codigo} obrigatorio
                 dica="Deve casar com o de-para do parser de recibo (ex.: DCTFWEB).">
            {(p) => (
              <input {...p} type="text" value={dados.codigo}
                     onChange={(e) => alterar('codigo', e.target.value.toUpperCase())}
                     placeholder="DCTFWEB" maxLength={30}
                     className={`${classesInput(erros.codigo)} font-mono`} />
            )}
          </Campo>

          <Campo label="Departamento" erro={erros.departamento} obrigatorio>
            {(p) => (
              <SelectNativo {...p} value={dados.departamento} erro={erros.departamento}
                            onChange={(e) => alterar('departamento', e.target.value)}
                            vazio="Selecione…"
                            opcoes={Object.entries(ROTULO_DEPARTAMENTO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            )}
          </Campo>
        </div>

        <Campo label="Nome" erro={erros.nome} obrigatorio>
          {(p) => (
            <input {...p} type="text" value={dados.nome}
                   onChange={(e) => alterar('nome', e.target.value)}
                   maxLength={150} className={classesInput(erros.nome)} />
          )}
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Esfera" erro={erros.esfera} obrigatorio>
            {(p) => (
              <SelectNativo {...p} value={dados.esfera} erro={erros.esfera}
                            onChange={(e) => alterar('esfera', e.target.value)}
                            opcoes={ESFERAS} />
            )}
          </Campo>

          <Campo label="Periodicidade" erro={erros.periodicidade} obrigatorio>
            {(p) => (
              <SelectNativo {...p} value={dados.periodicidade} erro={erros.periodicidade}
                            onChange={(e) => alterar('periodicidade', e.target.value)}
                            opcoes={Object.entries(ROTULO_PERIODICIDADE).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            )}
          </Campo>
        </div>

        {dados.esfera === 'ESTADUAL' && (
          <Campo label="UF" erro={erros.uf} obrigatorio>
            {(p) => (
              <SelectNativo {...p} value={dados.uf} erro={erros.uf}
                            onChange={(e) => alterar('uf', e.target.value)}
                            vazio="Selecione…" opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))} />
            )}
          </Campo>
        )}

        {dados.esfera === 'MUNICIPAL' && (
          <Campo label="Código IBGE do município" erro={erros.codigo_municipio} obrigatorio>
            {(p) => (
              <input {...p} type="text" inputMode="numeric" value={dados.codigo_municipio}
                     onChange={(e) => alterar('codigo_municipio', e.target.value.replace(/\D/g, '').slice(0, 7))}
                     placeholder="5208707"
                     className={`${classesInput(erros.codigo_municipio)} font-mono`} />
            )}
          </Campo>
        )}

        <fieldset className="space-y-4 rounded-lg border border-border-subtle p-4">
          <legend className="px-1 text-sm text-text-secondary">Regra de prazo</legend>
          <p className="text-xs text-text-muted">
            Esta é a primeira versão da regra. Quando o prazo legal mudar, crie uma nova
            versão em vez de editar esta — é o que mantém correto o reprocessamento de
            competências antigas.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Contagem" erro={erros.tipo_dia} obrigatorio>
              {(p) => (
                <SelectNativo {...p} value={dados.tipo_dia} erro={erros.tipo_dia}
                              onChange={(e) => alterar('tipo_dia', e.target.value)}
                              opcoes={[
                                { valor: 'CORRIDO', rotulo: 'Dia corrido' },
                                { valor: 'UTIL', rotulo: 'Dia útil' },
                              ]} />
              )}
            </Campo>

            <Campo label="Dia base" erro={erros.dia_base} obrigatorio
                   dica={dados.tipo_dia === 'UTIL' ? 'Ex.: 10 = décimo dia útil do mês.' : 'Ex.: 20 = dia 20.'}>
              {(p) => (
                <input {...p} type="number" min={1} max={31} value={dados.dia_base}
                       onChange={(e) => alterar('dia_base', e.target.value)}
                       className={`${classesInput(erros.dia_base)} font-mono`} />
              )}
            </Campo>
          </div>

          <Campo label="Mês de vencimento" erro={erros.referencia} obrigatorio>
            {(p) => (
              <SelectNativo {...p} value={dados.referencia} erro={erros.referencia}
                            onChange={(e) => alterar('referencia', e.target.value)}
                            opcoes={REFERENCIAS} />
            )}
          </Campo>

          {/* Ajuste só existe para dia corrido: contagem em dia útil já cai em
              dia útil por construção. */}
          {dados.tipo_dia === 'CORRIDO' && (
            <Campo label="Se cair em dia não útil" erro={erros.ajuste}>
              {(p) => (
                <SelectNativo {...p} value={dados.ajuste}
                              onChange={(e) => alterar('ajuste', e.target.value)}
                              opcoes={AJUSTES} />
              )}
            </Campo>
          )}

          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={dados.sabado_e_util}
                   onChange={(e) => alterar('sabado_e_util', e.target.checked)}
                   className="h-4 w-4 rounded border-border bg-card" />
            Sábado conta como dia útil para esta obrigação
          </label>

          <Campo label="Vigência a partir de" erro={erros.vigencia_inicio} obrigatorio
                 dica="Competências anteriores a esta data continuam usando a regra antiga.">
            {(p) => (
              <input {...p} type="date" value={dados.vigencia_inicio}
                     onChange={(e) => alterar('vigencia_inicio', e.target.value)}
                     className={classesInput(erros.vigencia_inicio)} />
            )}
          </Campo>
        </fieldset>

        {criar.error && (
          <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-sm text-error">
            {(criar.error as Error).message}
          </p>
        )}
      </div>
    </Modal>
  )
}
