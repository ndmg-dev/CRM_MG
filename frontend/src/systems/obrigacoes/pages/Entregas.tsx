import { useState } from 'react'
import { Filter, Paperclip, Search, Sparkles } from 'lucide-react'
import { Button } from '@mg/ui'
import { useEntregas, useRegistrarEntrega, useSessao } from '../hooks/useObrigacoes'
import { Carregando, ChipStatus, ErroCarregamento, TrilhoPrazo, Vazio } from '../components/Comuns'
import { podeDepartamento } from '../lib/sessao'
import {
  ROTULO_DEPARTAMENTO, ROTULO_STATUS, formatarCnpj, formatarCompetencia, formatarData,
} from '../lib/formato'
import type { Departamento, StatusEntrega } from '../types'

const DEPARTAMENTOS: Departamento[] = ['FISCAL', 'CONTABIL', 'PESSOAL']
const SITUACOES: StatusEntrega[] = [
  'PENDENTE', 'EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'ATRASADA', 'ENTREGUE', 'DISPENSADA',
]
const POR_PAGINA = 50

export function Entregas({ competencia }: { competencia: string }) {
  const [busca, setBusca] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [status, setStatus] = useState('')
  const [pagina, setPagina] = useState(0)

  const { data: sessao } = useSessao()
  const registrar = useRegistrarEntrega()
  const { data, isLoading, isError, error } = useEntregas({
    competencia, busca, departamento, status, pagina, porPagina: POR_PAGINA,
  })

  const limpar = () => {
    setBusca(''); setDepartamento(''); setStatus(''); setPagina(0)
  }

  const totalPaginas = Math.max(1, Math.ceil((data?.total ?? 0) / POR_PAGINA))

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
            placeholder="Buscar por empresa, CNPJ ou obrigação"
            aria-label="Buscar entregas"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold-border"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-text-muted" aria-hidden="true" />
          <select
            value={departamento}
            onChange={(e) => { setDepartamento(e.target.value); setPagina(0) }}
            aria-label="Filtrar por departamento"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-secondary focus:border-gold focus:outline-none"
          >
            <option value="">Todos os departamentos</option>
            {DEPARTAMENTOS.map((d) => (
              <option key={d} value={d}>{ROTULO_DEPARTAMENTO[d]}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPagina(0) }}
            aria-label="Filtrar por situação"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-secondary focus:border-gold focus:outline-none"
          >
            <option value="">Todas as situações</option>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>{ROTULO_STATUS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <Carregando label="Carregando entregas…" />
        ) : isError ? (
          <ErroCarregamento erro={error} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-divider bg-surface text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Obrigação</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Competência</th>
                  <th className="px-4 py-3 font-medium">Prazo</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Responsável</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data?.linhas.map((e) => {
                  const dep = e.obrigacao?.departamento
                  const podeBaixar =
                    e.status !== 'ENTREGUE' && dep ? podeDepartamento(sessao ?? null, dep) : false

                  return (
                    <tr key={e.id} className="border-b border-divider last:border-0 hover:bg-surface">
                      <td className="px-4 py-3">
                        <div className="text-text-primary">
                          {e.empresa?.nome_fantasia || e.empresa?.razao_social}
                        </div>
                        <div className="font-mono text-xs text-text-muted">
                          {e.empresa ? formatarCnpj(e.empresa.cnpj) : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-text-primary">{e.obrigacao?.nome}</div>
                        <div className="text-xs text-text-muted">
                          {dep ? ROTULO_DEPARTAMENTO[dep] : '—'}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-text-secondary md:table-cell">
                        {formatarCompetencia(e.competencia)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-text-primary">{formatarData(e.vencimento)}</div>
                        <TrilhoPrazo prazo={e.vencimento} status={e.status} />
                      </td>
                      <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">
                        {e.responsavel?.nome ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ChipStatus status={e.status} />
                        {/* Selo de baixa automática: deixa explícito o que foi
                            casado por recibo e o que foi confirmado por gente. */}
                        {e.origem_baixa === 'AUTOMATICA_RECIBO' && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-gold">
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            baixa automática
                          </div>
                        )}
                        {e.anexo_nome && (
                          <div className="mt-1 flex items-center gap-1 font-mono text-xs text-text-muted">
                            <Paperclip className="h-3 w-3" aria-hidden="true" />
                            {e.anexo_nome}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {podeBaixar && (
                          <Button
                            size="sm"
                            onClick={() => registrar.mutate(e.id)}
                            disabled={registrar.isPending}
                          >
                            Registrar entrega
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!data?.linhas.length && (
              <Vazio>
                Nenhuma entrega corresponde a esses filtros.{' '}
                <button onClick={limpar} className="font-medium text-gold hover:underline">
                  Limpar filtros
                </button>
              </Vazio>
            )}
          </div>
        )}
      </div>

      {registrar.isError && (
        <p className="text-sm text-error">
          {(registrar.error as Error).message}
        </p>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span className="font-mono text-xs text-text-muted">
            {data?.total} entregas · página {pagina + 1} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={pagina === 0}
                    onClick={() => setPagina((p) => Math.max(0, p - 1))}>
              Anterior
            </Button>
            <Button variant="ghost" size="sm" disabled={pagina + 1 >= totalPaginas}
                    onClick={() => setPagina((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
