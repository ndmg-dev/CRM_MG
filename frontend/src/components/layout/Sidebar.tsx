import { useEffect, useRef, useState } from 'react'
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
  Key,
  Moon,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { getSystemIcon } from '@/lib/icons'
import { getSetorColors, type SetorColors } from '@/lib/constants'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import SystemsMenu from './SystemsMenu'

const OPEN_CATEGORY_STORAGE_KEY = 'mg.sidebar.openCategory'

interface CategoryGroupProps {
  setor: string
  meta: SetorColors
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
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-label ${meta.text}`}
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
            const Icon = getSystemIcon(s.icone, s.id)
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

/**
 * Ordem da navegação: Dashboard, Sistemas, Clientes, Tarefas, Administração,
 * Auditoria. "Sistemas" não entra nestas listas porque não é um link simples —
 * abre o menu em cascata — e é renderizado entre `dashboardItem` e
 * `secondaryItems`.
 */
const dashboardItem = { to: '/', icon: LayoutDashboard, label: 'Dashboard' }

const navItems = [
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
  const expanded = useUIStore((s) => s.sidebarExpanded)
  const toggleExpanded = useUIStore((s) => s.toggleSidebarExpanded)

  const isAdmin = user?.perfil === 'ADMIN'
  const isSistemasActive = location.pathname.startsWith('/sistemas')
  const secondaryItems = isAdmin ? [...navItems, ...adminItems] : navItems

  // Submenu de categorias (nav expandida, mobile): aberto/fechado por clique,
  // não pela rota — senão clicar em "Sistemas" de novo nunca fecharia (a rota
  // já é /sistemas, não muda). Abre sozinho só ao ENTRAR na área de Sistemas
  // vindo de fora (não a cada troca de sistema dentro dela), pra não brigar
  // com um fechamento manual do usuário.
  const [sistemasSubmenuOpen, setSistemasSubmenuOpen] = useState(false)
  const prevPathRef = useRef(location.pathname)
  useEffect(() => {
    const wasOutside = !prevPathRef.current.startsWith('/sistemas')
    if (isSistemasActive && wasOutside) setSistemasSubmenuOpen(true)
    prevPathRef.current = location.pathname
  }, [location.pathname, isSistemasActive])

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
  // As cores por setor vivem em `constants.ts`, compartilhadas com o quadro
  // de tarefas.

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

  // Menu de Sistemas — só existe no rail de desktop (>= lg). No drawer
  // mobile "Sistemas" continua expandindo inline (ver bloco `lg:hidden`):
  // submenu por hover não funciona em toque.
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Navegar (para um sistema ou para qualquer outro item do rail) fecha o menu.
  useEffect(() => setMenuOpen(false), [location.pathname])

  // A posição vem do gatilho: o painel é portalado no `body` e precisa se
  // ancorar ao rail sem depender da árvore de layout.
  useEffect(() => {
    if (!menuOpen) return
    const place = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      // Ancora na borda do rail, não no botão (34px dentro de 64px) — senão o
      // painel abriria por cima da própria barra.
      const rail = trigger.closest('aside')?.getBoundingClientRect()
      const maxTop = Math.max(8, window.innerHeight - 640 - 8)
      setMenuPos({ top: Math.min(rect.top, maxTop), left: (rail?.right ?? rect.right) + 8 })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [menuOpen])

  const setorSistemaAtivo = location.pathname.startsWith('/sistemas/')
    ? sistemas.find(s => location.pathname.startsWith(`/sistemas/${s.id}`))?.setor ?? undefined
    : undefined

  // Botões do rodapé: mesmo tratamento visual (secundário, bordado) do
  // sistema de ponto de referência.
  const footerBtn =
    'flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-raised px-3 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-light hover:bg-surface hover:text-text-primary'

  // Botão de ícone do rail de desktop (34×34, icon-only) — usado quando
  // recolhido.
  const railIconBtnClass = (isActive: boolean) =>
    `flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border transition-colors ${
      isActive
        ? 'border-gold-border bg-gold-soft text-gold'
        : 'border-transparent text-text-secondary hover:bg-surface hover:text-text-primary'
    }`

  // Item do rail de desktop: icon-only (34×34) recolhido, linha cheia com
  // rótulo quando expandido — mesmo componente/gatilho nos dois estados.
  const desktopNavItemClass = (isActive: boolean) =>
    expanded
      ? `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
          isActive ? 'bg-gold-soft text-gold' : 'text-text-secondary hover:bg-surface hover:text-text-primary'
        }`
      : railIconBtnClass(isActive)

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-56 flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-in-out ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 ${expanded ? 'lg:w-56' : 'lg:w-16'}`}
      aria-label="Navegação principal"
    >
      {/* Marca */}
      <div className={`flex h-[52px] shrink-0 items-center border-b border-border px-4 ${expanded ? '' : 'lg:justify-center lg:px-2'}`}>
        <img src="/logo-icon.png" alt="" aria-hidden="true" className={`mr-2.5 h-7 w-7 shrink-0 object-contain ${expanded ? '' : 'lg:mr-0'}`} />
        <div className={`min-w-0 ${expanded ? '' : 'lg:hidden'}`}>
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

        {/* Expandir/recolher o rail (apenas desktop) */}
        <button
          onClick={toggleExpanded}
          aria-label={expanded ? 'Recolher menu de navegação' : 'Expandir menu de navegação'}
          title={expanded ? 'Recolher menu' : 'Expandir menu'}
          className={`hidden h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary lg:flex ${
            expanded ? 'ml-auto' : 'absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 rounded-full border border-border bg-sidebar shadow-sm'
          }`}
        >
          {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Navegação — mobile: lista completa com labels e acordeão inline (toque
          não sustenta hover, por isso o cascata do desktop não serve aqui). */}
      <nav className="flex-1 overflow-y-auto py-2 lg:hidden">
        <NavLink
          to={dashboardItem.to}
          className={`flex items-center gap-3 border-l-[3px] px-4 py-2.5 text-[13px] font-medium transition-colors ${
            location.pathname === dashboardItem.to
              ? 'border-gold bg-gold-soft text-gold'
              : 'border-transparent text-text-secondary hover:bg-surface hover:text-text-primary'
          }`}
        >
          <dashboardItem.icon className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">{dashboardItem.label}</span>
        </NavLink>

        <div className="flex flex-col">
          <NavLink
            to="/sistemas"
            onClick={(e) => {
              // Já estamos na área de Sistemas: o clique só alterna o
              // submenu, não precisa navegar de novo (mesma rota).
              if (isSistemasActive) {
                e.preventDefault()
                setSistemasSubmenuOpen((prev) => !prev)
              } else {
                setSistemasSubmenuOpen(true)
              }
            }}
            className={`flex items-center gap-3 border-l-[3px] px-4 py-2.5 text-[13px] font-medium transition-colors ${
              isSistemasActive
                ? 'border-gold bg-gold-soft text-gold'
                : 'border-transparent text-text-secondary hover:bg-surface hover:text-text-primary'
            }`}
          >
            <Grid3X3 className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">Sistemas</span>
          </NavLink>

          {sistemasSubmenuOpen && (
            <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden border-l-[3px] border-transparent bg-background/40 py-1 pl-4 pr-2">
              {Object.entries(sistemasBySetor).map(([setor, items]) => {
                const meta = getSetorColors(setor, nomeSetor[setor])
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

        {secondaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 border-l-[3px] px-4 py-2.5 text-[13px] font-medium transition-colors ${
              location.pathname.startsWith(item.to)
                ? 'border-gold bg-gold-soft text-gold'
                : 'border-transparent text-text-secondary hover:bg-surface hover:text-text-primary'
            }`}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Navegação — desktop: mesmo rail nos dois estados (só ícones quando
          recolhido, ícone+rótulo quando expandido), com o mesmo gatilho do
          menu de Sistemas em cascata — unifica o que antes era uma UI
          diferente por estado (flyout no colapsado x acordeão no expandido). */}
      <nav
        className={`hidden flex-1 flex-col gap-2.5 overflow-y-auto py-3.5 lg:flex ${
          expanded ? 'items-stretch px-2' : 'items-center'
        }`}
      >
        <NavLink
          to={dashboardItem.to}
          title={dashboardItem.label}
          className={desktopNavItemClass(location.pathname === dashboardItem.to)}
        >
          <dashboardItem.icon className="h-[18px] w-[18px] shrink-0" />
          {expanded && <span className="truncate">{dashboardItem.label}</span>}
        </NavLink>

        <button
          ref={triggerRef}
          type="button"
          title="Sistemas"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen(prev => !prev)}
          className={desktopNavItemClass(isSistemasActive || menuOpen)}
        >
          <Grid3X3 className="h-[18px] w-[18px] shrink-0" />
          {expanded && <span className="truncate">Sistemas</span>}
        </button>

        {menuOpen && (
          <SystemsMenu
            sistemasBySetor={sistemasBySetor}
            nomeSetor={nomeSetor}
            activeSetor={setorSistemaAtivo}
            position={menuPos}
            onClose={() => setMenuOpen(false)}
          />
        )}

        {secondaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={desktopNavItemClass(location.pathname.startsWith(item.to))}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {expanded && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Rodapé: usuário + ações */}
      <div className="shrink-0 border-t border-border p-2.5">
        {user && (
          <p
            title={user.email}
            className={`mb-2 truncate px-1 text-[11px] text-text-muted ${expanded ? '' : 'lg:hidden'}`}
          >
            {user.email}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {/* Alterar senha — sem handler no código atual; preservado como está. */}
          <button className={footerBtn} title="Alterar senha">
            <Key className="h-4 w-4 shrink-0" />
            <span className={expanded ? '' : 'lg:hidden'}>Alterar senha</span>
          </button>

          <button
            onClick={async () => { await endUnifiedSession(); window.location.href = '/login' }}
            className={footerBtn}
            title="Sair"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={expanded ? '' : 'lg:hidden'}>Sair</span>
          </button>

          {/* Seletor de tema — sem handler no código atual; preservado como está. */}
          <button className={footerBtn} title="Tema escuro">
            <Moon className="h-4 w-4 shrink-0" />
            <span className={expanded ? '' : 'lg:hidden'}>Tema escuro</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
