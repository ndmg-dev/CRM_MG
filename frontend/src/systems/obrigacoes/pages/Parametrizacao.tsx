import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge, Button } from '@mg/ui'
import { VincularForm } from '../components/VincularForm'
import {
  useCatalogo, useEmpresas, useEncerrarVinculo, useParametrizacao, useSessao,
} from '../hooks/useObrigacoes'
import { Carregando, ErroCarregamento, Vazio } from '../components/Comuns'
import { podeDepartamento } from '../lib/sessao'
import { ROTULO_DEPARTAMENTO, competenciaAtual, formatarData } from '../lib/formato'
import type { OrigemVinculo } from '../types'

const EXPLICACAO_ORIGEM: Record<OrigemVinculo, string> = {
  REGIME: 'Criado pela aplicação do regime tributário da empresa.',
  GRUPO: 'Criado pela aplicação de um grupo de obrigações.',
  MANUAL: 'Criado à mão por um colaborador.',
}

export function Parametrizacao({ empresaId: inicial }: { empresaId?: string | null }) {
  const [empresaId, setEmpresaId] = useState<string | null>(inicial ?? null)
  const [vincularAberto, setVincularAberto] = useState(false)
  const empresas = useEmpresas(competenciaAtual())
  const catalogo = useCatalogo()
  const vinculos = useParametrizacao(empresaId)
  const encerrar = useEncerrarVinculo()
  const { data: sessao } = useSessao()

  const naoVinculadas = (catalogo.data ?? []).filter(
    (o) => o.ativa && !(vinculos.data ?? []).some((v) => v.ativa && v.obrigacao_id === o.id),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="empresa" className="text-sm text-text-secondary">Empresa</label>
        <select
          id="empresa"
          value={empresaId ?? ''}
          onChange={(e) => setEmpresaId(e.target.value || null)}
          className="min-w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
        >
          <option value="">Selecione uma empresa…</option>
          {(empresas.data ?? []).map((e) => (
            <option key={e.empresa_id} value={e.empresa_id}>
              {e.nome_fantasia || e.razao_social}
            </option>
          ))}
        </select>
      </div>

      {!empresaId ? (
        <div className="rounded-lg border border-border bg-card">
          <Vazio>Escolha uma empresa para ver e ajustar as obrigações vinculadas.</Vazio>
        </div>
      ) : vinculos.isError ? (
        <ErroCarregamento erro={vinculos.error} />
      ) : vinculos.isLoading ? (
        <Carregando label="Carregando parametrização…" />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between border-b border-divider px-4 py-3">
              <h2 className="text-sm font-medium text-text-primary">Obrigações vinculadas</h2>
              <Button size="sm" onClick={() => setVincularAberto(true)}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Vincular
              </Button>
            </header>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-divider bg-surface text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 font-medium">Obrigação</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Vigência</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Responsável</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(vinculos.data ?? []).map((v) => {
                  const dep = v.obrigacao?.departamento
                  const podeMexer = dep ? podeDepartamento(sessao ?? null, dep) : false

                  return (
                    <tr key={v.id}
                        className={`border-b border-divider last:border-0 ${v.ativa ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3">
                        <div className="text-text-primary">{v.obrigacao?.nome}</div>
                        <div className="text-xs text-text-muted">
                          {v.obrigacao?.codigo}
                          {dep ? ` · ${ROTULO_DEPARTAMENTO[dep]}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {/* Origem rastreada: é o que impede a aplicação de um
                            regime de sobrescrever vínculo criado à mão. */}
                        <span title={EXPLICACAO_ORIGEM[v.origem]}>
                          <Badge>{v.origem}</Badge>
                        </span>
                        {v.origem_ref && (
                          <div className="mt-1 font-mono text-[11px] text-text-muted">{v.origem_ref}</div>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-text-secondary md:table-cell">
                        {formatarData(v.inicio)} → {v.fim ? formatarData(v.fim) : 'vigente'}
                      </td>
                      <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">
                        {v.responsavel?.nome ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v.ativa ? (
                          podeMexer && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={encerrar.isPending}
                              onClick={() =>
                                encerrar.mutate({ id: v.id, fim: new Date().toISOString().slice(0, 10) })
                              }
                            >
                              Encerrar
                            </Button>
                          )
                        ) : (
                          <span className="text-xs text-text-muted">encerrada</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!vinculos.data?.length && <Vazio>Nenhuma obrigação vinculada a esta empresa.</Vazio>}
          </div>

          {/* Encerrar mantém a linha na lista, com fim preenchido: o histórico
              de por que a obrigação existiu numa competência é auditável. */}
          <p className="text-xs text-text-muted">
            Vínculos não são apagados — são encerrados com data de fim, e continuam visíveis acima.
          </p>

          {naoVinculadas.length > 0 && (
            <details className="rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm text-text-secondary">
                {naoVinculadas.length} obrigação(ões) do catálogo ainda não vinculada(s)
              </summary>
              <ul className="divide-y divide-divider border-t border-divider">
                {naoVinculadas.map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-text-primary">
                      {o.nome}{' '}
                      <span className="text-xs text-text-muted">
                        · {ROTULO_DEPARTAMENTO[o.departamento]}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {encerrar.isError && (
        <p className="text-sm text-error">{(encerrar.error as Error).message}</p>
      )}

      {empresaId && vincularAberto && (
        <VincularForm
          empresaId={empresaId}
          idsJaVinculados={(vinculos.data ?? []).filter((v) => v.ativa).map((v) => v.obrigacao_id)}
          onFechar={() => setVincularAberto(false)}
        />
      )}
    </div>
  )
}
