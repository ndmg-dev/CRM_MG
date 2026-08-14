import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@mg/ui'
import { useEmpresas, useSessao } from '../hooks/useObrigacoes'
import { Carregando, ErroCarregamento, Vazio } from '../components/Comuns'
import { EmpresaForm } from '../components/EmpresaForm'
import { ROTULO_REGIME, formatarCnpj, formatarCompetencia } from '../lib/formato'

export function Empresas({
  competencia,
  onAbrirParametrizacao,
}: {
  competencia: string
  onAbrirParametrizacao: (empresaId: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const { data, isLoading, isError, error } = useEmpresas(competencia)
  const { data: sessao } = useSessao()

  // Cadastro de empresa é do escritório e restrito a ADMIN/GESTOR — o mesmo
  // recorte da policy `empresa_write`. Aqui é só para não oferecer o botão.
  const podeCadastrar =
    sessao?.perimetro === 'COLABORADOR' && ['ADMIN', 'GESTOR'].includes(sessao.papel)

  const abrirNova = () => { setEditandoId(null); setFormAberto(true) }
  const abrirEdicao = (id: string) => { setEditandoId(id); setFormAberto(true) }

  const termo = busca.trim().toLowerCase()
  const filtradas = (data ?? []).filter((e) =>
    !termo ||
    [e.razao_social, e.nome_fantasia, e.cnpj]
      .filter(Boolean)
      .some((c) => String(c).toLowerCase().includes(termo)),
  )

  if (isError) return <ErroCarregamento erro={error} />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa por nome ou CNPJ"
            aria-label="Buscar empresas"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold-border"
          />
        </div>
        {podeCadastrar && (
          <Button onClick={abrirNova}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nova empresa
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <Carregando label="Carregando empresas…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-divider bg-surface text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Regime</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Responsável</th>
                  <th className="px-4 py-3 font-medium">
                    Situação em {formatarCompetencia(competencia)}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((e) => {
                  const emAberto = e.total - e.entregues
                  return (
                    <tr key={e.empresa_id} className="border-b border-divider last:border-0 hover:bg-surface">
                      <td className="px-4 py-3">
                        <div className="text-text-primary">{e.nome_fantasia || e.razao_social}</div>
                        <div className="font-mono text-xs text-text-muted">{formatarCnpj(e.cnpj)}</div>
                      </td>
                      <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                        {ROTULO_REGIME[e.regime]}
                      </td>
                      <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">
                        {e.responsavel ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {e.total === 0 ? (
                          <span className="text-xs text-text-muted">
                            sem obrigações nesta competência
                          </span>
                        ) : (
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-mono text-text-primary">
                              {e.entregues}/{e.total}
                            </span>
                            <span className="text-text-muted">entregues</span>
                            {e.atrasadas > 0 && (
                              <span className="rounded-full bg-error-soft px-2 py-0.5 text-error">
                                {e.atrasadas} em atraso
                              </span>
                            )}
                            {e.atrasadas === 0 && emAberto > 0 && (
                              <span className="text-text-muted">{emAberto} em aberto</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {podeCadastrar && (
                            <button
                              onClick={() => abrirEdicao(e.empresa_id)}
                              className="text-xs font-medium text-text-secondary hover:text-text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-gold-border"
                            >
                              Editar
                            </button>
                          )}
                          <button
                            onClick={() => onAbrirParametrizacao(e.empresa_id)}
                            className="text-xs font-medium text-gold hover:underline focus:outline-none focus:ring-2 focus:ring-gold-border"
                          >
                            Parametrizar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!filtradas.length && <Vazio>Nenhuma empresa encontrada.</Vazio>}
          </div>
        )}
      </div>

      <EmpresaForm
        aberto={formAberto}
        empresaId={editandoId}
        onFechar={() => setFormAberto(false)}
      />
    </div>
  )
}
