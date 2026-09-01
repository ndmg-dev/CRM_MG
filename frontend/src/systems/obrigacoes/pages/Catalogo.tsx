import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge, Button } from '@mg/ui'
import { useCatalogo, useSessao } from '../hooks/useObrigacoes'
import { Carregando, ErroCarregamento, Vazio } from '../components/Comuns'
import { ObrigacaoForm } from '../components/ObrigacaoForm'
import { EditarObrigacaoForm } from '../components/EditarObrigacaoForm'
import { podeDepartamento } from '../lib/sessao'
import { ROTULO_DEPARTAMENTO, ROTULO_PERIODICIDADE } from '../lib/formato'
import type { Esfera, Obrigacao } from '../types'

const ROTULO_ESFERA: Record<Esfera, string> = {
  FEDERAL: 'Federal',
  ESTADUAL: 'Estadual',
  MUNICIPAL: 'Municipal',
  INTERNA: 'Interna',
}

/** Catálogo mestre: cadastro por TIPO de obrigação, nunca por empresa. */
export function Catalogo() {
  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<Obrigacao | null>(null)
  const { data, isLoading, isError, error } = useCatalogo()
  const { data: sessao } = useSessao()

  // Quem não administra departamento nenhum não cadastra obrigação: a policy
  // `obrigacao_write` exige RBAC por departamento no próprio insert.
  const podeCadastrar =
    sessao?.perimetro === 'COLABORADOR' &&
    (sessao.papel === 'ADMIN' || sessao.departamentos.length > 0)

  if (isError) return <ErroCarregamento erro={error} />

  return (
    <div className="space-y-4">
      {podeCadastrar && (
        <div className="flex justify-end">
          <Button onClick={() => setFormAberto(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nova obrigação
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
      {isLoading ? (
        <Carregando label="Carregando catálogo…" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-divider bg-surface text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Obrigação</th>
                <th className="px-4 py-3 font-medium">Departamento</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Esfera</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Periodicidade</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((o) => (
                <tr key={o.id} className="border-b border-divider last:border-0 hover:bg-surface">
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{o.codigo}</td>
                  <td className="px-4 py-3">
                    <div className="text-text-primary">{o.nome}</div>
                    {o.descricao && (
                      <div className="text-xs text-text-muted">{o.descricao}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {ROTULO_DEPARTAMENTO[o.departamento]}
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                    {ROTULO_ESFERA[o.esfera]}
                    {o.uf ? ` · ${o.uf}` : ''}
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                    {ROTULO_PERIODICIDADE[o.periodicidade]}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!o.ativa && <Badge>encerrada</Badge>}
                    {/* O botão só aparece para quem o RLS deixaria escrever:
                        RBAC por departamento vale no banco, aqui é só para não
                        oferecer uma ação que o servidor recusaria. Antes era um
                        rótulo "editável" sem clique nenhum — sobrava do hook já
                        pronto (useAtualizarObrigacao) sem tela nenhuma usando. */}
                    {o.ativa && podeDepartamento(sessao ?? null, o.departamento) && (
                      <button
                        onClick={() => setEditando(o)}
                        className="text-xs font-medium text-gold hover:underline focus:outline-none focus:ring-2 focus:ring-gold-border"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!data?.length && <Vazio>Nenhuma obrigação cadastrada.</Vazio>}
          </div>
        )}
      </div>

      {formAberto && <ObrigacaoForm onFechar={() => setFormAberto(false)} />}
      {editando && (
        <EditarObrigacaoForm obrigacao={editando} onFechar={() => setEditando(null)} />
      )}
    </div>
  )
}
