import { useState } from 'react'
import { Button, Modal } from '@mg/ui'
import { Campo, SelectNativo } from './Campo'
import { classesInput } from '../lib/estilos'
import { useCatalogo, useSessao, useVincularObrigacao } from '../hooks/useObrigacoes'
import { useColaboradores } from '../hooks/useCadastros'
import { podeDepartamento } from '../lib/sessao'
import { ROTULO_DEPARTAMENTO } from '../lib/formato'

const HOJE = new Date().toISOString().slice(0, 10)

/**
 * Vincula uma obrigação do catálogo a uma empresa.
 *
 * O vínculo criado aqui é sempre de origem MANUAL. REGIME e GRUPO são
 * gerados por rotina — marcar um vínculo manual como REGIME faria a próxima
 * aplicação do regime tributário sobrescrever a escolha de um humano.
 */
// O pai monta este componente só quando abre, então o estado nasce limpo —
// sem `useEffect` + `setState` para resetar.
export function VincularForm({
  empresaId,
  idsJaVinculados,
  onFechar,
}: {
  empresaId: string
  idsJaVinculados: string[]
  onFechar: () => void
}) {
  const [obrigacaoId, setObrigacaoId] = useState('')
  const [inicio, setInicio] = useState(HOJE)
  const [responsavelId, setResponsavelId] = useState('')
  const [erro, setErro] = useState('')

  const catalogo = useCatalogo()
  const colaboradores = useColaboradores()
  const { data: sessao } = useSessao()
  const vincular = useVincularObrigacao()

  // Só oferece o que a pessoa pode mesmo vincular: o RLS recusaria obrigação
  // de departamento fora do RBAC dela, e o erro apareceria só depois do envio.
  const disponiveis = (catalogo.data ?? []).filter(
    (o) => o.ativa
      && !idsJaVinculados.includes(o.id)
      && podeDepartamento(sessao ?? null, o.departamento),
  )

  const salvar = async () => {
    if (!obrigacaoId) { setErro('Escolha a obrigação.'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) { setErro('Informe a data de início.'); return }
    setErro('')
    try {
      await vincular.mutateAsync({
        empresaId, obrigacaoId, inicio, responsavelId: responsavelId || null,
      })
      onFechar()
    } catch { /* mensagem exibida abaixo */ }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => { if (!o) onFechar() }}
      title="Vincular obrigação"
      description="O vínculo nasce com origem MANUAL e não é sobrescrito pela aplicação de regime."
      actions={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={vincular.isPending}>Cancelar</Button>
          <Button onClick={salvar} disabled={vincular.isPending || !disponiveis.length}>
            {vincular.isPending ? 'Vinculando…' : 'Vincular'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!disponiveis.length ? (
          <p className="text-sm text-text-secondary">
            Não há obrigação disponível para vincular — ou todas já estão vinculadas, ou
            estão em departamentos fora das suas permissões.
          </p>
        ) : (
          <>
            <Campo label="Obrigação" obrigatorio>
              {(p) => (
                <SelectNativo
                  {...p}
                  value={obrigacaoId}
                  onChange={(e) => setObrigacaoId(e.target.value)}
                  vazio="Selecione…"
                  opcoes={disponiveis.map((o) => ({
                    valor: o.id,
                    rotulo: `${o.nome} · ${ROTULO_DEPARTAMENTO[o.departamento]}`,
                  }))}
                />
              )}
            </Campo>

            <Campo label="Vigente a partir de" obrigatorio
                   dica="Entregas passam a ser geradas a partir desta competência.">
              {(p) => (
                <input {...p} type="date" value={inicio}
                       onChange={(e) => setInicio(e.target.value)}
                       className={classesInput()} />
              )}
            </Campo>

            <Campo label="Responsável">
              {(p) => (
                <SelectNativo {...p} value={responsavelId}
                              onChange={(e) => setResponsavelId(e.target.value)}
                              vazio="Herdar da empresa"
                              opcoes={(colaboradores.data ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))} />
              )}
            </Campo>
          </>
        )}

        {(erro || vincular.error) && (
          <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-sm text-error">
            {erro || (vincular.error as Error).message}
          </p>
        )}
      </div>
    </Modal>
  )
}
