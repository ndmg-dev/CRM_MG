import { useState } from 'react'
import { Button, Modal } from '@mg/ui'
import { Campo, SelectNativo } from './Campo'
import { classesInput } from '../lib/estilos'
import { useAtualizarEmpresa, useColaboradores, useCriarEmpresa, useEmpresa } from '../hooks/useCadastros'
import { UFS, mascararCnpj, temErro, validarEmpresa } from '../lib/validacao'
import type { DadosEmpresa, ErrosFormulario } from '../lib/validacao'
import { ROTULO_REGIME } from '../lib/formato'

const VAZIO: DadosEmpresa = {
  razao_social: '', nome_fantasia: '', cnpj: '', regime: '',
  uf: '', codigo_municipio: '', responsavel_id: '',
}

const REGIMES = Object.entries(ROTULO_REGIME).map(([valor, rotulo]) => ({ valor, rotulo }))

/**
 * Casca: resolve o carregamento e só então monta o formulário, passando os
 * valores iniciais por prop.
 *
 * Foi feito assim para não sincronizar props em `useEffect` + `setState` —
 * padrão que dispara render em cascata e que o lint do repo barra. O `key`
 * garante estado novo a cada abertura e a cada troca de empresa.
 */
export function EmpresaForm({
  aberto,
  empresaId,
  onFechar,
}: {
  aberto: boolean
  empresaId: string | null
  onFechar: () => void
}) {
  const existente = useEmpresa(aberto ? empresaId : null)

  if (!aberto) return null

  if (empresaId && existente.isLoading) {
    return (
      <Modal open onOpenChange={(o) => { if (!o) onFechar() }} title="Editar empresa">
        <p className="text-sm text-text-secondary">Carregando…</p>
      </Modal>
    )
  }

  const e = existente.data
  const inicial: DadosEmpresa = e
    ? {
        razao_social: e.razao_social ?? '',
        nome_fantasia: e.nome_fantasia ?? '',
        cnpj: mascararCnpj(e.cnpj ?? ''),
        regime: e.regime ?? '',
        uf: e.uf ?? '',
        codigo_municipio: e.codigo_municipio ?? '',
        responsavel_id: e.responsavel_id ?? '',
      }
    : VAZIO

  return (
    <Formulario
      key={empresaId ?? 'nova'}
      empresaId={empresaId}
      inicial={inicial}
      onFechar={onFechar}
    />
  )
}

function Formulario({
  empresaId,
  inicial,
  onFechar,
}: {
  empresaId: string | null
  inicial: DadosEmpresa
  onFechar: () => void
}) {
  const [dados, setDados] = useState<DadosEmpresa>(inicial)
  const [erros, setErros] = useState<ErrosFormulario>({})
  const [enviado, setEnviado] = useState(false)

  const colaboradores = useColaboradores()
  const criar = useCriarEmpresa()
  const atualizar = useAtualizarEmpresa()

  const alterar = (campo: keyof DadosEmpresa, valor: string) => {
    const novos = { ...dados, [campo]: valor }
    setDados(novos)
    // Só revalida depois da primeira tentativa: validar enquanto a pessoa ainda
    // digita o primeiro caractere só produz erro prematuro.
    if (enviado) setErros(validarEmpresa(novos))
  }

  const salvar = async () => {
    const e = validarEmpresa(dados)
    setErros(e)
    setEnviado(true)
    if (temErro(e)) return
    try {
      if (empresaId) await atualizar.mutateAsync({ id: empresaId, dados })
      else await criar.mutateAsync(dados)
      onFechar()
    } catch {
      // A mensagem aparece abaixo, vinda da mutation.
    }
  }

  const salvando = criar.isPending || atualizar.isPending
  const falha = (criar.error ?? atualizar.error) as Error | null

  return (
    <Modal
      open
      onOpenChange={(o) => { if (!o) onFechar() }}
      title={empresaId ? 'Editar empresa' : 'Nova empresa'}
      description={
        empresaId
          ? 'Alterações valem daqui para frente; entregas já geradas não mudam.'
          : 'A empresa nasce sem obrigações — vincule-as depois em Parametrização.'
      }
      actions={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Campo label="Razão social" erro={erros.razao_social} obrigatorio>
          {(p) => (
            <input {...p} type="text" value={dados.razao_social}
                   onChange={(ev) => alterar('razao_social', ev.target.value)}
                   className={classesInput(erros.razao_social)} maxLength={255} />
          )}
        </Campo>

        <Campo label="Nome fantasia" erro={erros.nome_fantasia}>
          {(p) => (
            <input {...p} type="text" value={dados.nome_fantasia}
                   onChange={(ev) => alterar('nome_fantasia', ev.target.value)}
                   className={classesInput(erros.nome_fantasia)} maxLength={150} />
          )}
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="CNPJ" erro={erros.cnpj} obrigatorio
                 dica="Os dígitos verificadores são conferidos.">
            {(p) => (
              <input {...p} type="text" inputMode="numeric" value={dados.cnpj}
                     onChange={(ev) => alterar('cnpj', mascararCnpj(ev.target.value))}
                     placeholder="00.000.000/0000-00"
                     className={`${classesInput(erros.cnpj)} font-mono`} />
            )}
          </Campo>

          <Campo label="Regime tributário" erro={erros.regime} obrigatorio>
            {(p) => (
              <SelectNativo {...p} value={dados.regime} erro={erros.regime}
                            onChange={(ev) => alterar('regime', ev.target.value)}
                            vazio="Selecione…" opcoes={REGIMES} />
            )}
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="UF" erro={erros.uf}>
            {(p) => (
              <SelectNativo {...p} value={dados.uf} erro={erros.uf}
                            onChange={(ev) => alterar('uf', ev.target.value)}
                            vazio="—" opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))} />
            )}
          </Campo>

          <Campo label="Código IBGE do município" erro={erros.codigo_municipio}
                 dica="Necessário para o feriado municipal entrar no cálculo de prazo.">
            {(p) => (
              <input {...p} type="text" inputMode="numeric" value={dados.codigo_municipio}
                     onChange={(ev) => alterar('codigo_municipio', ev.target.value.replace(/\D/g, '').slice(0, 7))}
                     placeholder="5208707"
                     className={`${classesInput(erros.codigo_municipio)} font-mono`} />
            )}
          </Campo>
        </div>

        <Campo label="Responsável" erro={erros.responsavel_id}>
          {(p) => (
            <SelectNativo {...p} value={dados.responsavel_id}
                          onChange={(ev) => alterar('responsavel_id', ev.target.value)}
                          vazio="Sem responsável"
                          opcoes={(colaboradores.data ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))} />
          )}
        </Campo>

        {falha && (
          <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-sm text-error">
            {falha.message}
          </p>
        )}
      </div>
    </Modal>
  )
}
