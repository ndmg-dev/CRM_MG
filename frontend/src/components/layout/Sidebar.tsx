import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { endUnifiedSession } from '@/lib/unifiedAuth'
import {
  LayoutDashboard,
  Grid3X3,
  Users,
  ClipboardList,
  Shield,
  Eye,
  LogOut,
  Building2,
  Key,
  Moon,
  Search,
  X,
} from 'lucide-react'
import { ICON_MAP } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'

const OPEN_CATEGORY_STORAGE_KEY = 'mg.sidebar.openCategory'

interface CategoryGroupProps {
  setor: string
  meta: { label: string; color: string; activeClass: string }
  items: Array<{ id: string; nome: string; icone: string }>
  isOpen: boolean
  onToggle: () => void
}

/** Cabeçalho de categoria colapsável dentro da lista de sistemas (mobile e flyout desktop). */
function CategoryGroup({ setor, meta, items, isOpen, onToggle }: CategoryGroupProps) {
  const panelId = `sidebar-categoria-${setor}`

  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-label ${meta.color}`}
      >
        <span className="truncate">{meta.label}</span>
        <span className="font-mono text-[9.5px] font-normal normal-case tracking-normal text-[#55555e]">
          {items.length}
        </span>
        <span
          aria-hidden="true"
          className="ml-auto h-1.5 w-1.5 shrink-0 border-b-[1.5px] border-r-[1.5px] border-[#55555e] transition-transform duration-[220ms] ease-in-out"
          style={{ transform: isOpen ? 'rotate(-135deg)' : 'rotate(45deg)' }}
        />
      </button>

      {isOpen && (
        <div id={panelId} role="group">
          {items.map((s, idx) => {
            const Icon = ICON_MAP[s.icone] || Building2
            return (
              <NavLink
                key={s.id}
                to={`/sistemas/${s.id}`}
                end
                className={({ isActive: isSubActive }) =>
                  `sidebar-category-item flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors ${
                    isSubActive ? meta.activeClass : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                  }`
                }
                style={{ animationDelay: `${idx * 15}ms` }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{s.nome}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/tarefas', icon: ClipboardList, label: 'Tarefas' },
]

const adminItems = [
  { to: '/admin', icon: Shield, label: 'Administração' },
  { to: '/auditoria', icon: Eye, label: 'Auditoria' },
]

interface SidebarProps {
  /** Drawer aberto em telas < lg. */
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)

  const isAdmin = user?.perfil === 'ADMIN'
  const isSistemasActive = location.pathname.startsWith('/sistemas')
  const restItems = isAdmin ? [...navItems, ...adminItems] : navItems

  const { data: sistemas = [] } = useQuery({
    queryKey: ['sistemas'],
    queryFn: () => api.sistemas.getAll(),
  })

  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => api.setores.getAll(),
  })

  // O backend já entrega apenas os sistemas permitidos pela política do setor
  // do usuário (services/visibility_service.py). Aqui só agrupamos.
  const SETOR_LABELS: Record<string, { label: string; color: string; activeClass: string }> = {
    DP: { label: 'Dep. Pessoal', color: 'text-blue-400', activeClass: 'bg-blue-500/10 text-blue-400 font-semibold' },
    CONTABIL: { label: 'Contábil', color: 'text-emerald-400', activeClass: 'bg-emerald-500/10 text-emerald-400 font-semibold' },
    FISCAL: { label: 'Fiscal', color: 'text-orange-400', activeClass: 'bg-orange-500/10 text-orange-400 font-semibold' },
    SOCIETARIO: { label: 'Societário', color: 'text-purple-400', activeClass: 'bg-purple-500/10 text-purple-400 font-semibold' },
    TI: { label: 'Tecnologia (TI)', color: 'text-cyan-400', activeClass: 'bg-cyan-500/10 text-cyan-400 font-semibold' },
    GERAL: { label: 'Geral', color: 'text-text-muted', activeClass: 'bg-gold/10 text-gold font-semibold' },
    RESTRITO: { label: 'Restrito', color: 'text-red-500', activeClass: 'bg-red-500/10 text-red-500 font-semibold' },
  }

  // Os grupos saem dos sistemas recebidos, não de uma lista fixa — assim um
  // setor criado pelo admin também ganha sua seção.
  const nomeSetor = Object.fromEntries(setores.map(s => [s.codigo, s.nome]))
  const setorOrder = [...new Set(sistemas.map(s => s.setor ?? 'GERAL'))].sort((a, b) =>
    (nomeSetor[a] || a).localeCompare(nomeSetor[b] || b)
  )
  const sistemasBySetor = setorOrder.reduce((acc, setor) => {
    const found = sistemas.filter(s => (s.setor ?? 'GERAL') === setor)
    if (found.length > 0) acc[setor] = found
    return acc
  }, {} as Record<string, typeof sistemas>)

  // Accordion: só uma categoria aberta por vez. A rota ativa tem prioridade
  // sobre o valor salvo em localStorage no momento da montagem.
  const [openCategory, setOpenCategory] = useState<string | null>(null)

  useEffect(() => {
    if (setorOrder.length === 0) return

    const activeSistema = location.pathname.startsWith('/sistemas/')
      ? sistemas.find(s => location.pathname === `/sistemas/${s.id}` || location.pathname.startsWith(`/sistemas/${s.id}/`))
      : undefined

    if (activeSistema) {
      setOpenCategory(activeSistema.setor ?? 'GERAL')
      return
    }

    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(OPEN_CATEGORY_STORAGE_KEY) : null
    if (saved && (setorOrder as string[]).includes(saved)) {
      setOpenCategory(saved)
    } else {
      setOpenCategory(setorOrder[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setorOrder.join(','), sistemas.length])

  const handleToggleCategory = (setor: string) => {
    setOpenCategory(prev => {
      const next = prev === setor ? null : setor
      if (typeof window !== 'undefined') {
        if (next) window.localStorage.setItem(OPEN_CATEGORY_STORAGE_KEY, next)
        else window.localStorage.removeItem(OPEN_CATEGORY_STORAGE_KEY)
      }
      return next
    })
  }

  // Flyout de "Sistemas" — só existe no rail de desktop (>= lg). No drawer
  // mobile "Sistemas" continua expandindo inline (ver bloco `lg:hidden`).
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 })
  const [search, setSearch] = useState('')
  const flyoutRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Navegar (para um sistema ou para qualquer outro item do rail) fecha o flyout.
  useEffect(() => setFlyoutOpen(false), [location.pathname])

  // O painel é renderizado em portal no `body`: dentro da `aside` ele seria
  // recortado pelo `overflow-y-auto` da nav, e o `transform` da própria aside
  // ainda quebraria um `position: fixed`. Logo, a posição vem do botão.
  useEffect(() => {
    if (!flyoutOpen) return
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const maxTop = Math.max(8, window.innerHeight - 520 - 8)
      setFlyoutPos({ top: Math.min(rect.top, maxTop), left: rect.right + 8 })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [flyoutOpen])

  useEffect(() => {
    if (!flyoutOpen) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      // O próprio gatilho é tratado pelo seu onClick; ignorá-lo aqui evita
      // fechar no mousedown e reabrir no click seguinte.
      if (triggerRef.current?.contains(target)) return
      if (flyoutRef.current && !flyoutRef.current.contains(target)) {
        setFlyoutOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFlyoutOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [flyoutOpen])

  useEffect(() => {
    if (flyoutOpen) {
      searchInputRef.current?.focus()
    } else {
      setSearch('')
    }
  }, [flyoutOpen])

  const query = search.trim().toLowerCase()
  const isFiltering = query.length > 0
  const flyoutSistemasBySetor = isFiltering
    ? setorOrder.reduce((acc, setor) => {
        const found = (sistemasBySetor[setor] || []).filter(s => s.nome.toLowerCase().includes(query))
        if (found.length > 0) acc[setor] = found
        return acc
      }, {} as typeof sistemasBySetor)
    : sistemasBySetor

  // Botões do rodapé: mesmo tratamento visual (secundário, bordado) do
  // sistema de ponto de referência.
  const footerBtn =
    'flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-raised px-3 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-light hover:bg-surface hover:text-text-primary'

  // Botão de ícone do rail de desktop (34×34, sempre icon-only).
  const railIconBtnClass = (isActive: boolean) =>
    `flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border transition-colors ${
      isActive
        ? 'border-gold-border bg-gold-soft text-gold'
        : 'border-transparent text-text-secondary hover:bg-surface hover:text-text-primary'
    }`

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-56 flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-in-out ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:w-16 lg:translate-x-0`}
      aria-label="Navegação principal"
    >
      {/* Marca */}
      <div className="flex h-[52px] shrink-0 items-center border-b border-border px-4 lg:justify-center lg:px-2">
        <img src="/logo-icon.png" alt="" aria-hidden="true" className="mr-2.5 h-7 w-7 shrink-0 object-contain lg:mr-0" />
        <div className="min-w-0 lg:hidden">
          <p className="truncate text-[12px] font-semibold uppercase tracking-label text-gold">
            Mendonça Galvão
          </p>
          <p className="truncate text-[10px] text-text-muted">Contadores Associados</p>
        </div>

        {/* Fechar drawer (apenas mobile) */}
        <button
          onClick={onMobileClose}
          aria-label="Fechar menu de navegação"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary lg:hidden"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Navegação — mobile: lista completa com labels e acordeão inline. */}
      <nav className="flex-1 overflow-y-auto py-2 lg:hidden">
        <div className="flex flex-col">
          <NavLink
            to="/sistemas"
            className={`flex items-center gap-3 border-l-[3px] px-4 py-2.5 text-[13px] font-medium transition-colors ${
              isSistemasActive
                ? 'border-gold bg-gold-soft text-gold'
                : 'border-transparent text-text-secondary hover:bg-surface hover:text-text-primary'
            }`}
          >
            <Grid3X3 className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">Sistemas</span>
          </NavLink>

          {isSistemasActive && (
            <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden border-l-[3px] border-transparent bg-background/40 py-1 pl-4 pr-2">
              {Object.entries(sistemasBySetor).map(([setor, items]) => {
                const meta = SETOR_LABELS[setor] || { label: nomeSetor[setor] || setor, color: 'text-text-muted', activeClass: 'bg-gold/10 text-gold font-semibold' }
                return (
                  <CategoryGroup
                    key={setor}
                    setor={setor}
                    meta={meta}
                    items={items}
                    isOpen={openCategory === setor}
                    onToggle={() => handleToggleCategory(setor)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {restItems.map((item) => {
          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 border-l-[3px] px-4 py-2.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'border-gold bg-gold-soft text-gold'
                  : 'border-transparent text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Navegação — desktop: rail icon-only + flyout de "Sistemas". */}
      <nav className="hidden flex-1 flex-col items-center gap-2.5 overflow-y-auto py-3.5 lg:flex">
        <button
          ref={triggerRef}
          type="button"
          title="Sistemas"
          aria-expanded={flyoutOpen}
          aria-haspopup="menu"
          onClick={() => setFlyoutOpen(prev => !prev)}
          className={railIconBtnClass(isSistemasActive || flyoutOpen)}
        >
          <Grid3X3 className="h-[18px] w-[18px] shrink-0" />
        </button>

        {flyoutOpen && createPortal(
            <div
              ref={flyoutRef}
              role="menu"
              aria-label="Sistemas"
              style={{ top: flyoutPos.top, left: flyoutPos.left }}
              className="fixed z-50 flex max-h-[520px] w-[230px] flex-col gap-2.5 rounded-[10px] border border-border bg-card p-3.5 shadow-overlay animate-fade-in"
            >
              <div className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar sistema…"
                  className="w-full min-w-0 bg-transparent text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
                {Object.entries(flyoutSistemasBySetor).map(([setor, items]) => {
                  const meta = SETOR_LABELS[setor] || { label: nomeSetor[setor] || setor, color: 'text-text-muted', activeClass: 'bg-gold/10 text-gold font-semibold' }
                  return (
                    <CategoryGroup
                      key={setor}
                      setor={setor}
                      meta={meta}
                      items={items}
                      isOpen={isFiltering || openCategory === setor}
                      onToggle={() => handleToggleCategory(setor)}
                    />
                  )
                })}
                {isFiltering && Object.keys(flyoutSistemasBySetor).length === 0 && (
                  <p className="px-2 py-3 text-center text-[12px] text-text-muted">Nenhum sistema encontrado.</p>
                )}
              </div>

              <NavLink
                to="/sistemas"
                className="shrink-0 truncate rounded-md border-t border-border px-2 pt-2 text-center text-[11px] font-medium text-text-muted transition-colors hover:text-gold"
              >
                Ver central de sistemas
              </NavLink>
            </div>,
            document.body,
        )}

        {restItems.map((item) => {
          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to)

          return (
            <NavLink key={item.to} to={item.to} title={item.label} className={railIconBtnClass(isActive)}>
              <item.icon className="h-[18px] w-[18px] shrink-0" />
            </NavLink>
          )
        })}
      </nav>

      {/* Rodapé: usuário + ações */}
      <div className="shrink-0 border-t border-border p-2.5">
        {user && (
          <p
            title={user.email}
            className="mb-2 truncate px-1 text-[11px] text-text-muted lg:hidden"
          >
            {user.email}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {/* Alterar senha — sem handler no código atual; preservado como está. */}
          <button className={footerBtn} title="Alterar senha">
            <Key className="h-4 w-4 shrink-0" />
            <span className="lg:hidden">Alterar senha</span>
          </button>

          <button
            onClick={async () => { await endUnifiedSession(); window.location.href = '/login' }}
            className={footerBtn}
            title="Sair"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="lg:hidden">Sair</span>
          </button>

          {/* Seletor de tema — sem handler no código atual; preservado como está. */}
          <button className={footerBtn} title="Tema escuro">
            <Moon className="h-4 w-4 shrink-0" />
            <span className="lg:hidden">Tema escuro</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
