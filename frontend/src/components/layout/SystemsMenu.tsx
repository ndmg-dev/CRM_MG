import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { ChevronRight, LayoutGrid, Search } from 'lucide-react'
import { getSetorIcon, getSystemIcon } from '@/lib/icons'
import { getSetorColors } from '@/lib/constants'
import type { Sistema } from '@/types'

interface SystemsMenuProps {
  /** Sistemas agrupados por código de setor, na ordem de exibição. */
  sistemasBySetor: Record<string, Sistema[]>
  /** Nome dos setores vindos da API, para os cadastrados pelo admin. */
  nomeSetor: Record<string, string>
  /** Setor do sistema aberto agora — abre já apontando para ele. */
  activeSetor?: string
  /** Canto superior esquerdo do painel, calculado a partir do gatilho. */
  position: { top: number; left: number }
  onClose: () => void
}

/**
 * Menu em cascata de Sistemas. O painel lista as categorias colapsadas; passar
 * o mouse (ou o foco) numa categoria abre o submenu com os sistemas dela à
 * direita.
 *
 * O painel vai para um portal no `body` de propósito: dentro da `aside` ele
 * seria recortado pelo `overflow` da nav, e o `transform` da própria aside
 * quebraria até um `position: fixed`.
 */
export default function SystemsMenu({
  sistemasBySetor,
  nomeSetor,
  activeSetor,
  position,
  onClose,
}: SystemsMenuProps) {
  const setores = Object.keys(sistemasBySetor)

  const [query, setQuery] = useState('')
  // Categoria cujo submenu está aberto. Abrir o menu já aponta para o setor do
  // sistema em uso; sem isso, para a primeira categoria.
  const [activeCat, setActiveCat] = useState<string | null>(
    () => (activeSetor && sistemasBySetor[activeSetor] ? activeSetor : setores[0]) ?? null,
  )
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const termo = query.trim().toLowerCase()

  // Uma categoria aparece se o próprio rótulo casa com a busca ou se sobrou ao
  // menos um sistema dela. Sem busca, tudo aparece.
  const categorias = useMemo(() => {
    return setores
      .map((setor) => {
        const meta = getSetorColors(setor, nomeSetor[setor])
        const todos = sistemasBySetor[setor] || []
        const casaRotulo = meta.label.toLowerCase().includes(termo)
        const itens = !termo || casaRotulo
          ? todos
          : todos.filter((s) => s.nome.toLowerCase().includes(termo))
        return { setor, meta, itens, total: todos.length }
      })
      .filter((c) => !termo || c.itens.length > 0)
  }, [setores, sistemasBySetor, nomeSetor, termo])

  // Buscar pode esconder a categoria que estava aberta; reaponta para a
  // primeira ainda visível em vez de deixar o submenu sumir sem substituto.
  const catVisivel = categorias.some((c) => c.setor === activeCat)
  const catAtiva = catVisivel ? activeCat : categorias[0]?.setor ?? null

  return createPortal(
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[45] bg-black/35"
      />

      <div
        role="menu"
        aria-label="Sistemas"
        style={{ top: position.top, left: position.left }}
        className="animate-pop-in fixed z-50 flex max-h-[640px] w-[308px] flex-col rounded-[14px] border border-border bg-card shadow-overlay"
      >
        {/* Busca */}
        <div className="shrink-0 px-3.5 pb-2.5 pt-3.5">
          <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-background px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar sistema..."
              aria-label="Buscar sistema"
              className="w-full min-w-0 bg-transparent text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        </div>

        {/* Categorias. `overflow-visible` é obrigatório: qualquer recorte aqui
            cortaria o submenu, que escapa pela lateral. */}
        <div className="overflow-visible px-2 pb-2 pt-0.5">
          {categorias.map(({ setor, meta, itens, total }) => {
            const SetorIcon = getSetorIcon(setor)
            const aberta = catAtiva === setor

            return (
              <div
                key={setor}
                className="relative"
                onMouseEnter={() => setActiveCat(setor)}
              >
                <button
                  type="button"
                  aria-expanded={aberta}
                  onFocus={() => setActiveCat(setor)}
                  className={`flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-left transition-colors ${
                    aberta ? 'bg-surface' : 'bg-transparent'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] ${meta.bg}`}
                  >
                    <SetorIcon className={`h-[15px] w-[15px] ${meta.text}`} />
                  </span>
                  <span className={`truncate text-[12.5px] font-extrabold uppercase tracking-[0.05em] ${meta.text}`}>
                    {meta.label}
                  </span>
                  <span className="text-[11px] font-bold text-text-muted tabular-nums">
                    {termo ? itens.length : total}
                  </span>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                </button>

                {/* Submenu. O `pl-3` é ponte: sem ele o mouse cruzaria um vão
                    entre a linha e o card, e o submenu fecharia no caminho. */}
                {aberta && (
                  <div className="absolute left-full top-[-8px] z-20 pl-3">
                    <div className="animate-fly-in w-[262px] overflow-hidden rounded-xl border border-border bg-surface-raised shadow-overlay">
                      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 shrink-0 rounded-[3px] ${meta.dot}`}
                        />
                        <span className={`truncate text-[12px] font-extrabold uppercase tracking-[0.05em] ${meta.text}`}>
                          {meta.label}
                        </span>
                      </div>

                      <div className="max-h-[60vh] overflow-y-auto p-1.5">
                        {itens.map((s) => {
                          const Icon = getSystemIcon(s.icone, s.id)
                          return (
                            <NavLink
                              key={s.id}
                              to={`/sistemas/${s.id}`}
                              end
                              onClick={onClose}
                              className={({ isActive }) =>
                                `flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 transition-colors ${
                                  isActive ? meta.activeClass : `text-text-secondary ${meta.hoverBg}`
                                }`
                              }
                            >
                              <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                              <span className="truncate text-[13.5px] font-medium text-text-primary">
                                {s.nome}
                              </span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {categorias.length === 0 && (
            <p className="px-2.5 py-6 text-center text-[13px] text-text-muted">
              Nenhum sistema encontrado.
            </p>
          )}
        </div>

        {/* Rodapé */}
        <div className="shrink-0 border-t border-border p-2">
          <NavLink
            to="/sistemas"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-[9px] py-2.5 text-[13.5px] font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            <LayoutGrid className="h-[15px] w-[15px]" aria-hidden="true" />
            Ver central de sistemas
          </NavLink>
        </div>
      </div>
    </>,
    document.body,
  )
}
