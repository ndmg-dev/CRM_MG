import { useState } from 'react'
import { Button, Modal } from '@mg/ui'
import { Campo, SelectNativo } from './Campo'
import { classesInput } from '../lib/estilos'
import { usePrazos, useAtualizarObrigacao, useNovaVersaoPrazo } from '../hooks/useCadastros'
import { ROTULO_DEPARTAMENTO, ROTULO_PERIODICIDADE, formatarData } from '../lib/formato'
import type { Obrigacao } from '../types'

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

const HOJE = new Date().toISOString().slice(0, 10)

/**
 * Edição de uma obrigação já cadastrada.
 *
 * Só nome/descrição/periodicidade são editáveis (via `useAtualizarObrigacao`)
 * — código, departamento e esfera são a identidade da obrigação e o schema
 * não deixa mudar depois (mudar o código quebraria o de-para do parser de
 * recibo; mudar departamento/esfera reabriria toda a discussão de RBAC e
 * geografia que a validação de cadastro já fechou). Mostrados como leitura.
 *
 * A regra de prazo tem sua própria lógica de versão: nunca se edita uma
 * regra existente, sempre se cria uma nova vigência (`useNovaVersaoPrazo`,
 * que encerra a anterior sozinho) — é o que mantém correto o reprocessamento
 * de competências antigas. Ver comentário em hooks/useCadastros.ts.
 */
export function EditarObrigacaoForm({
  obrigacao,
  onFechar,
}: {
  obrigacao: Obrigacao
  onFechar: () => void
}) {
  const [nome, setNome] = useState(obrigacao.nome)
  const [descricao, setDescricao] = useState(obrigacao.descricao ?? '')
  const [periodicidade, setPeriodicidade] = useState(obrigacao.periodicidade)
  const [erroNome, setErroNome] = useState('')

  const [novaVersaoAberta, setNovaVersaoAberta] = useState(false)

  const prazos = usePrazos(obrigacao.id)
  const atualizar = useAtualizarObrigacao()

  const vigente = (prazos.data ?? []).find((p) => !p.vigencia_fim)

  const salvarDados = async () => {
    const nomeAparado = nome.trim()
    if (nomeAparado.length < 2) { setErroNome('Informe o nome da obrigação.'); return }
    setErroNome('')
    try {
      await atualizar.mutateAsync({
        id: obrigacao.id,
        dados: {
          codigo: obrigacao.codigo, nome: nomeAparado, descricao, departamento: obrigacao.departamento,
          esfera: obrigacao.esfera, periodicidade, uf: obrigacao.uf ?? '',
          codigo_municipio: '', tipo_dia: '', dia_base: '', referencia: '', ajuste: '',
          sabado_e_util: false, vigencia_inicio: '',
        },
      })
    } catch { /* mensagem exibida abaixo */ }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => { if (!o) onFechar() }}
      title="Editar obrigação"
      description={`${obrigacao.codigo} · ${ROTULO_DEPARTAMENTO[obrigacao.departamento]}`}
      actions={<Button variant="ghost" onClick={onFechar}>Fechar</Button>}
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">Dados gerais</h3>

          <Campo label="Nome" erro={erroNome} obrigatorio>
            {(p) => (
              <input {...p} type="text" value={nome}
                     onChange={(e) => setNome(e.target.value)}
                     maxLength={150} className={classesInput(erroNome)} />
            )}
          </Campo>

          <Campo label="Descrição">
            {(p) => (
              <textarea {...p} value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        maxLength={2000} rows={3} className={classesInput()} />
            )}
          </Campo>

          <Campo label="Periodicidade" obrigatorio>
            {(p) => (
              <SelectNativo {...p} value={periodicidade}
                            onChange={(e) => setPeriodicidade(e.target.value as Obrigacao['periodicidade'])}
                            opcoes={Object.entries(ROTULO_PERIODICIDADE).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            )}
          </Campo>

          {/* Identidade da obrigação — não editável depois do cadastro. */}
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border-subtle bg-card-alt p-3 font-mono text-xs sm:grid-cols-4">
            <div>
              <dt className="text-text-muted">Código</dt>
              <dd className="mt-0.5 text-text-secondary">{obrigacao.codigo}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Departamento</dt>
              <dd className="mt-0.5 text-text-secondary">{ROTULO_DEPARTAMENTO[obrigacao.departamento]}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Esfera</dt>
              <dd className="mt-0.5 text-text-secondary">{obrigacao.esfera}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Escopo</dt>
              <dd className="mt-0.5 text-text-secondary">{obrigacao.uf || '—'}</dd>
            </div>
          </dl>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={salvarDados} disabled={atualizar.isPending}>
              {atualizar.isPending ? 'Salvando…' : 'Salvar dados gerais'}
            </Button>
            {atualizar.isSuccess && !atualizar.isPending && (
              <span className="text-xs text-success">Salvo.</span>
            )}
          </div>
          {atualizar.isError && (
            <p role="alert" className="text-sm text-error">{(atualizar.error as Error).message}</p>
          )}
        </section>

        <section className="space-y-3 border-t border-divider pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Regras de prazo</h3>
            {!novaVersaoAberta && (
              <Button variant="ghost" size="sm" onClick={() => setNovaVersaoAberta(true)}>
                Nova versão
              </Button>
            )}
          </div>

          {prazos.isLoading ? (
            <p className="text-sm text-text-secondary">Carregando…</p>
          ) : (
            <ul className="divide-y divide-divider rounded-lg border border-border-subtle">
              {(prazos.data ?? []).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="font-mono text-text-secondary">
                    {p.tipo_dia === 'UTIL' ? `${p.dia_base}º dia útil` : `dia ${p.dia_base}`} ·{' '}
                    {REFERENCIAS.find((r) => r.valor === p.referencia)?.rotulo ?? p.referencia}
                  </span>
                  <span className="font-mono text-text-muted">
                    {formatarData(p.vigencia_inicio)} → {p.vigencia_fim ? formatarData(p.vigencia_fim) : 'vigente'}
                  </span>
                </li>
              ))}
              {!prazos.data?.length && (
                <li className="px-3 py-4 text-center text-xs text-text-muted">
                  Nenhuma regra de prazo cadastrada — esta obrigação não gera entrega.
                </li>
              )}
            </ul>
          )}

          {novaVersaoAberta && (
            <NovaVersaoPrazo
              obrigacaoId={obrigacao.id}
              vigenteId={vigente?.id ?? null}
              onFechar={() => setNovaVersaoAberta(false)}
            />
          )}
        </section>
      </div>
    </Modal>
  )
}

function NovaVersaoPrazo({
  obrigacaoId,
  vigenteId,
  onFechar,
}: {
  obrigacaoId: string
  vigenteId: string | null
  onFechar: () => void
}) {
  const [tipoDia, setTipoDia] = useState<'CORRIDO' | 'UTIL'>('CORRIDO')
  const [diaBase, setDiaBase] = useState('')
  const [referencia, setReferencia] = useState('MES_SEGUINTE')
  const [ajuste, setAjuste] = useState('ANTECIPA')
  const [sabadoEUtil, setSabadoEUtil] = useState(false)
  const [vigenciaInicio, setVigenciaInicio] = useState(HOJE)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')

  const criar = useNovaVersaoPrazo()

  const salvar = async () => {
    const dia = Number(diaBase)
    if (!diaBase || !Number.isInteger(dia) || dia < 1 || dia > 31) {
      setErro('O dia base vai de 1 a 31.'); return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vigenciaInicio)) {
      setErro('Informe a data de início da vigência.'); return
    }
    setErro('')
    try {
      await criar.mutateAsync({
        obrigacaoId, vigenteId, tipo_dia: tipoDia, dia_base: dia, referencia,
        ajuste, sabado_e_util: sabadoEUtil, vigencia_inicio: vigenciaInicio,
        observacao: observacao.trim() || undefined,
      })
      onFechar()
    } catch { /* mensagem exibida abaixo */ }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-card-alt p-3">
      {vigenteId && (
        <p className="text-xs text-text-muted">
          A regra vigente hoje é encerrada automaticamente no dia anterior ao início desta.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Contagem" obrigatorio>
          {(p) => (
            <SelectNativo {...p} value={tipoDia}
                          onChange={(e) => setTipoDia(e.target.value as 'CORRIDO' | 'UTIL')}
                          opcoes={[
                            { valor: 'CORRIDO', rotulo: 'Dia corrido' },
                            { valor: 'UTIL', rotulo: 'Dia útil' },
                          ]} />
          )}
        </Campo>

        <Campo label="Dia base" erro={erro.includes('dia base') ? erro : undefined} obrigatorio>
          {(p) => (
            <input {...p} type="number" min={1} max={31} value={diaBase}
                   onChange={(e) => setDiaBase(e.target.value)}
                   className={`${classesInput()} font-mono`} />
          )}
        </Campo>
      </div>

      <Campo label="Mês de vencimento" obrigatorio>
        {(p) => (
          <SelectNativo {...p} value={referencia} onChange={(e) => setReferencia(e.target.value)}
                        opcoes={REFERENCIAS} />
        )}
      </Campo>

      {tipoDia === 'CORRIDO' && (
        <Campo label="Se cair em dia não útil">
          {(p) => (
            <SelectNativo {...p} value={ajuste} onChange={(e) => setAjuste(e.target.value)}
                          opcoes={AJUSTES} />
          )}
        </Campo>
      )}

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" checked={sabadoEUtil}
               onChange={(e) => setSabadoEUtil(e.target.checked)}
               className="h-4 w-4 rounded border-border bg-card" />
        Sábado conta como dia útil para esta obrigação
      </label>

      <Campo label="Vigência a partir de" obrigatorio>
        {(p) => (
          <input {...p} type="date" value={vigenciaInicio}
                 onChange={(e) => setVigenciaInicio(e.target.value)}
                 className={classesInput()} />
        )}
      </Campo>

      <Campo label="Observação" dica="Ex.: motivo legal da mudança — fica no histórico.">
        {(p) => (
          <input {...p} type="text" value={observacao}
                 onChange={(e) => setObservacao(e.target.value)}
                 maxLength={255} className={classesInput()} />
        )}
      </Campo>

      {erro && <p role="alert" className="text-xs text-error">{erro}</p>}
      {criar.isError && (
        <p role="alert" className="text-xs text-error">{(criar.error as Error).message}</p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={salvar} disabled={criar.isPending}>
          {criar.isPending ? 'Salvando…' : 'Criar nova versão'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onFechar} disabled={criar.isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
