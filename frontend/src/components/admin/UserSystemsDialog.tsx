import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { getSystemIcon } from '@/lib/icons'
import { getSetorColors } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { SetorRecord, Sistema, Usuario, VisibilidadeUsuario } from '@/types'

interface UserSystemsDialogProps {
  user: Usuario
  onClose: () => void
}

const MODOS: Array<{
  value: VisibilidadeUsuario
  label: string
  descricao: string
}> = [
  {
    value: 'SETOR',
    label: 'Seguir o setor',
    descricao:
      'Vê o que a política do setor libera, mais os sistemas marcados abaixo. Desmarcar aqui não esconde o que vem do setor.',
  },
  {
    value: 'INDIVIDUAL',
    label: 'Lista personalizada',
    descricao:
      'Vê exatamente os sistemas marcados abaixo, e nada mais — a política do setor deixa de valer para este usuário.',
  },
]

interface ConteudoProps {
  user: Usuario
  sistemas: Sistema[]
  setores: SetorRecord[]
  /** Sistemas já concedidos individualmente — a base do formulário. */
  concedidos: Sistema[]
  onClose: () => void
}

/**
 * Separado do invólucro porque o estado inicial nasce dos acessos já
 * concedidos: montar só depois que eles chegam permite inicializar o
 * `useState` direto, sem um efeito para semear estado.
 */
function Conteudo({ user, sistemas, setores, concedidos, onClose }: ConteudoProps) {
  const queryClient = useQueryClient()

  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(concedidos.map((s) => s.id)),
  )
  const [modo, setModo] = useState<VisibilidadeUsuario>(user.visibilidadeSistemas ?? 'SETOR')
  const [busca, setBusca] = useState('')

  const nomeSetor = useMemo(
    () => Object.fromEntries(setores.map((s) => [s.codigo, s.nome])),
    [setores],
  )

  const porSetor = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const filtrados = termo
      ? sistemas.filter((s) => s.nome.toLowerCase().includes(termo))
      : sistemas

    const grupos = filtrados.reduce<Record<string, Sistema[]>>((acc, s) => {
      const codigo = String(s.setor || 'GERAL')
      ;(acc[codigo] ||= []).push(s)
      return acc
    }, {})

    return Object.entries(grupos).sort(([a], [b]) =>
      (nomeSetor[a] || a).localeCompare(nomeSetor[b] || b),
    )
  }, [sistemas, busca, nomeSetor])

  const salvar = useMutation({
    mutationFn: async () => {
      const atual = new Set(concedidos.map((s) => s.id))

      const conceder = [...selecionados].filter((id) => !atual.has(id))
      const revogar = [...atual].filter((id) => !selecionados.has(id))

      // Uma chamada por sistema: é o que as rotas expõem. Sequencial de
      // propósito — em paralelo, uma falha no meio deixaria o resto em estado
      // indefinido e sem ordem previsível na auditoria.
      for (const sistemaId of conceder) {
        await api.acessos.grant(user.id, sistemaId)
      }
      for (const sistemaId of revogar) {
        await api.acessos.revoke(user.id, sistemaId)
      }

      if (modo !== (user.visibilidadeSistemas ?? 'SETOR')) {
        await api.usuarios.update(user.id, { visibilidadeSistemas: modo })
      }

      return { conceder: conceder.length, revogar: revogar.length }
    },
    onSuccess: ({ conceder, revogar }) => {
      queryClient.invalidateQueries({ queryKey: ['acessos', user.id] })
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      // O próprio admin pode ter mexido no que ele mesmo enxerga.
      queryClient.invalidateQueries({ queryKey: ['sistemas'] })
      toast.success(
        conceder || revogar
          ? `Acessos atualizados (${conceder} liberado(s), ${revogar} removido(s)).`
          : 'Acessos atualizados.',
      )
      onClose()
    },
    onError: (err: Error) => {
      // Parte das chamadas pode ter passado antes do erro; recarregar evita
      // deixar a tela mostrando um estado que o servidor não tem.
      queryClient.invalidateQueries({ queryKey: ['acessos', user.id] })
      toast.error(err.message || 'Erro ao salvar os acessos.')
    },
  })

  const alternar = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const total = selecionados.size
  const labelSetorUsuario = user.setor ? nomeSetor[user.setor] || user.setor : null

  const resumo =
    modo === 'INDIVIDUAL'
      ? `Este usuário verá exatamente ${total} sistema(s).`
      : labelSetorUsuario
        ? `Vê os sistemas liberados pelo setor ${labelSetorUsuario} e mais ${total} liberado(s) individualmente.`
        : `Sem setor definido: hoje vê apenas os sistemas Gerais e os ${total} liberado(s) individualmente.`

  return (
    <>
      {/* Modo */}
      <div className="shrink-0 space-y-2 border-b border-border px-5 py-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {MODOS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setModo(m.value)}
              aria-pressed={modo === m.value}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                modo === m.value
                  ? 'border-gold-border bg-gold-soft'
                  : 'border-border bg-surface-raised hover:border-border-light',
              )}
            >
              <span
                className={cn(
                  'block text-[13px] font-semibold',
                  modo === m.value ? 'text-gold' : 'text-text-primary',
                )}
              >
                {m.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-text-muted">
                {m.descricao}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[12px] text-text-secondary">{resumo}</p>
      </div>

      {/* Busca */}
      <div className="shrink-0 px-5 pt-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar sistema..."
            aria-label="Buscar sistema"
            className="w-full min-w-0 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        {porSetor.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-text-muted">
            Nenhum sistema encontrado.
          </p>
        ) : (
          porSetor.map(([codigo, itens]) => {
            const meta = getSetorColors(codigo, nomeSetor[codigo])
            return (
              <div key={codigo} className="mb-3">
                <p className={cn('mb-1 px-1 text-[10px] font-bold uppercase tracking-label', meta.text)}>
                  {meta.label}
                </p>
                {itens.map((s) => {
                  const Icon = getSystemIcon(s.icone, s.id)
                  const restrito = String(s.setor) === 'RESTRITO'

                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface"
                    >
                      <input
                        type="checkbox"
                        checked={selecionados.has(s.id)}
                        onChange={() => alternar(s.id)}
                        className="h-4 w-4 shrink-0 accent-gold"
                      />
                      <Icon className="h-4 w-4 shrink-0 text-text-muted" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">
                        {s.nome}
                      </span>
                      {restrito && (
                        <span
                          title="Sistema restrito: por padrão só administradores veem. Marcar aqui libera para este usuário."
                          className="flex shrink-0 items-center gap-1 rounded bg-error-soft px-1.5 py-0.5 text-[10px] font-medium text-error"
                        >
                          <Lock className="h-3 w-3" />
                          Restrito
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )
          })
        )}
      </div>

      {/* Rodapé */}
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3.5">
        <Button variant="secondary" onClick={onClose} disabled={salvar.isPending}>
          Cancelar
        </Button>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando...' : 'Salvar acessos'}
        </Button>
      </div>
    </>
  )
}

/**
 * Seleção de sistemas por usuário, para os cargos que não se encaixam na
 * política do setor. A política de setor é coletiva: restringir uma pessoa
 * mexendo nela atingiria todos os colegas dela, daí a decisão viver no usuário.
 */
export default function UserSystemsDialog({ user, onClose }: UserSystemsDialogProps) {
  const { data: sistemas = [], isLoading: carregandoSistemas } = useQuery({
    queryKey: ['sistemas'],
    queryFn: () => api.sistemas.getAll(),
  })

  const { data: setores = [], isLoading: carregandoSetores } = useQuery({
    queryKey: ['setores'],
    queryFn: () => api.setores.getAll(),
  })

  // Só os sistemas concedidos um a um — o que vem do setor não entra aqui.
  const { data: concedidos = [], isLoading: carregandoAcessos } = useQuery({
    queryKey: ['acessos', user.id],
    queryFn: () => api.acessos.getByUser(user.id),
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const carregando = carregandoSistemas || carregandoSetores || carregandoAcessos

  return createPortal(
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-50 bg-black/60" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Sistemas de ${user.nome}`}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(94vw,620px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-overlay"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-text-primary">
              Sistemas de {user.nome}
            </h2>
            <p className="truncate text-[12px] text-text-muted">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {carregando ? (
          <div className="px-5 py-10">
            <LoadingSpinner label="Carregando acessos..." />
          </div>
        ) : (
          <Conteudo
            user={user}
            sistemas={sistemas}
            setores={setores}
            concedidos={concedidos}
            onClose={onClose}
          />
        )}
      </div>
    </>,
    document.body,
  )
}
