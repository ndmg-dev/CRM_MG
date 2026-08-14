import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
  Key,
  Moon,
  X,
} from 'lucide-react'
import { ICON_MAP } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sistemas', icon: Grid3X3, label: 'Sistemas' },
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
  const { sidebarOpen, toggleSidebar } = useUIStore()

  const isAdmin = user?.perfil === 'ADMIN'
  const allItems = isAdmin ? [...navItems, ...adminItems] : navItems

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

  // `collapsed` é o modo ícone-apenas do desktop. No drawer mobile a lista
  // sempre aparece expandida, senão o menu ficaria ilegível.
  const collapsed = !sidebarOpen

  // Botões do rodapé: mesmo tratamento visual (secundário, bordado) do
  // sistema de ponto de referência.
  const footerBtn =
    'flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-raised px-3 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-light hover:bg-surface hover:text-text-primary'

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-56 flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-in-out lg:transition-[width] ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 ${collapsed ? 'lg:w-[72px]' : 'lg:w-56'}`}
      aria-label="Navegação principal"
    >
      {/* Marca */}
      <div className={`flex h-[52px] shrink-0 items-center border-b border-border ${collapsed ? 'lg:justify-center lg:px-2' : ''} px-4`}>
        <img src="/logo-icon.png" alt="" aria-hidden="true" className={`h-7 w-7 shrink-0 object-contain ${collapsed ? 'lg:mr-0' : 'mr-2.5'}`} />
        <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
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

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-2">
        {allItems.map((item) => {
          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to)

          return (
            <div key={item.to} className="flex flex-col">
              <NavLink
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 border-l-[3px] px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  collapsed ? 'lg:justify-center lg:px-0' : ''
                } ${
                  isActive
                    ? 'border-gold bg-gold-soft text-gold'
                    : 'border-transparent text-text-secondary hover:bg-surface hover:text-text-primary'
                }`}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
              </NavLink>

              <AnimatePresence>
                {item.to === '/sistemas' && isActive && !collapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="max-h-[50vh] overflow-y-auto overflow-x-hidden border-l-[3px] border-transparent bg-background/40 py-1 pl-4 pr-2"
                  >
                    {Object.entries(sistemasBySetor).map(([setor, items]) => {
                      const meta = SETOR_LABELS[setor] || { label: nomeSetor[setor] || setor, color: 'text-text-muted', activeClass: 'bg-gold/10 text-gold font-semibold' }
                      return (
                        <div key={setor} className="mb-1.5">
                          <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-label ${meta.color}`}>
                            {meta.label}
                          </div>
                          {items.map(s => {
                            const Icon = ICON_MAP[s.icone] || Building2
                            return (
                              <NavLink
                                key={s.id}
                                to={`/sistemas/${s.id}`}
                                end
                                className={({ isActive: isSubActive }) =>
                                  `flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors ${
                                    isSubActive ? meta.activeClass : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                                  }`
                                }
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{s.nome}</span>
                              </NavLink>
                            )
                          })}
                        </div>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Rodapé: usuário + ações */}
      <div className="shrink-0 border-t border-border p-2.5">
        {user && (
          <p
            title={user.email}
            className={`mb-2 truncate px-1 text-[11px] text-text-muted ${collapsed ? 'lg:hidden' : ''}`}
          >
            {user.email}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {/* Alterar senha — sem handler no código atual; preservado como está. */}
          <button className={footerBtn} title={collapsed ? 'Alterar senha' : undefined}>
            <Key className="h-4 w-4 shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Alterar senha</span>
          </button>

          <button
            onClick={async () => { await endUnifiedSession(); window.location.href = '/login' }}
            className={footerBtn}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Sair</span>
          </button>

          {/* Seletor de tema — sem handler no código atual; preservado como está. */}
          <button className={footerBtn} title={collapsed ? 'Tema escuro' : undefined}>
            <Moon className="h-4 w-4 shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Tema escuro</span>
          </button>
        </div>

        {/* Colapso — recurso de desktop, some no drawer mobile */}
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          className="mt-1.5 hidden w-full items-center justify-center rounded-md py-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-secondary lg:flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}
