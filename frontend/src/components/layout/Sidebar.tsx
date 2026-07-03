import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  LayoutDashboard,
  Grid3X3,
  Users,
  ClipboardList,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
  Calculator,
  Plane,
  BarChart3,
  Receipt,
  Headphones,
  Bot,
  Sparkles,
  Cpu,
  CalendarCheck,
  MessageCircle,
  Clock,
  UserCircle,
  Percent,
  FileText,
  Calendar,
  User,
  DollarSign,
  Store,
  Megaphone,
  Target,
  Palmtree,
  FileCheck,
  Fingerprint,
  HandCoins,
  Mail,
  UserMinus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { getInitials } from '@/lib/utils'

const ICON_MAP: Record<string, LucideIcon> = {
  'building-2': Building2,
  'calculator': Calculator,
  'bar-chart-3': BarChart3,
  'headphones': Headphones,
  'bot': Bot,
  'sparkles': Sparkles,
  'cpu': Cpu,
  'clock': Clock,
  'user-circle': UserCircle,
  'percent': Percent,
  'store': Store,
  'megaphone': Megaphone,
  'target': Target,
  'palmtree': Palmtree,
  'file-check': FileCheck,
  'fingerprint': Fingerprint,
  'hand-coins': HandCoins,
  'mail': Mail,
  'user-minus': UserMinus,
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sistemas', icon: Grid3X3, label: 'Sistemas' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/tarefas', icon: ClipboardList, label: 'Tarefas' },
]

const adminItems = [
  { to: '/admin', icon: Shield, label: 'Administração' },
]

export default function Sidebar() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { sidebarOpen, toggleSidebar } = useUIStore()

  const isAdmin = user?.perfil === 'ADMIN'
  const allItems = isAdmin ? [...navItems, ...adminItems] : navItems

  const { data: sistemas = [] } = useQuery({
    queryKey: ['sistemas'],
    queryFn: () => api.sistemas.getAll(),
  })

  const isManager = user?.perfil === 'ADMIN' || user?.perfil === 'COORDENADOR'

  const visibleSistemas = sistemas.filter((s) => {
    const setorSistema = s.setor ?? 'GERAL'
    if (setorSistema === 'RESTRITO') {
      return user?.perfil === 'ADMIN'
    }
    if (isManager) return true
    return setorSistema === 'GERAL' || setorSistema === user?.setor
  })

  const SETOR_LABELS: Record<string, { label: string; color: string; activeClass: string }> = {
    DP: { label: 'Dep. Pessoal', color: 'text-blue-400', activeClass: 'bg-blue-500/10 text-blue-400 font-semibold' },
    CONTABIL: { label: 'Contábil', color: 'text-emerald-400', activeClass: 'bg-emerald-500/10 text-emerald-400 font-semibold' },
    FISCAL: { label: 'Fiscal', color: 'text-orange-400', activeClass: 'bg-orange-500/10 text-orange-400 font-semibold' },
    SOCIETARIO: { label: 'Societário', color: 'text-purple-400', activeClass: 'bg-purple-500/10 text-purple-400 font-semibold' },
    TI: { label: 'Tecnologia (TI)', color: 'text-cyan-400', activeClass: 'bg-cyan-500/10 text-cyan-400 font-semibold' },
    GERAL: { label: 'Geral', color: 'text-[#6b6b6b]', activeClass: 'bg-[#d4a843]/10 text-[#d4a843] font-semibold' },
    RESTRITO: { label: 'Restrito', color: 'text-red-500', activeClass: 'bg-red-500/10 text-red-500 font-semibold' },
  }

  const setorOrder = ['DP', 'CONTABIL', 'FISCAL', 'SOCIETARIO', 'TI', 'GERAL', 'RESTRITO']
  const sistemasBySetor = setorOrder.reduce((acc, setor) => {
    const found = visibleSistemas.filter(s => (s.setor ?? 'GERAL') === setor)
    if (found.length > 0) acc[setor] = found
    return acc
  }, {} as Record<string, typeof visibleSistemas>)

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 256 : 72 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-[#1e1e1e] bg-[#111111]"
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-[#1e1e1e] px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center">
          <img src="/logo-icon.png" alt="MG Logo" className="h-full w-full object-contain" />
        </div>
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-semibold text-[#f5f5f5] whitespace-nowrap">Mendonça Galvão</p>
              <p className="text-xs text-[#6b6b6b] whitespace-nowrap">CRM Contábil</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {allItems.map((item) => {
          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to)

          return (
            <div key={item.to} className="flex flex-col">
              <NavLink
                to={item.to}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#d4a843]/10 text-[#d4a843]'
                    : 'text-[#a0a0a0] hover:bg-[#1e1e1e] hover:text-[#f5f5f5]'
                }`}
              >
                <div className="relative shrink-0">
                  <item.icon className="h-5 w-5" />
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute -left-[21px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#d4a843]"
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </div>
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>

              <AnimatePresence>
                {item.to === '/sistemas' && isActive && sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="ml-11 mt-1 flex flex-col gap-1 overflow-hidden max-h-[50vh] overflow-y-auto"
                  >
                    {Object.entries(sistemasBySetor).map(([setor, items]) => {
                      const meta = SETOR_LABELS[setor] || { label: setor, color: 'text-[#6b6b6b]', activeClass: 'bg-[#d4a843]/10 text-[#d4a843] font-semibold' }
                      return (
                        <div key={setor} className="mb-2">
                          <div className={`py-1 text-[10px] font-bold tracking-wider uppercase ${meta.color}`}>
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
                                  `flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                                    isSubActive ? meta.activeClass : 'text-[#a0a0a0] hover:bg-[#1e1e1e] hover:text-[#f5f5f5]'
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

      {/* Footer: User info + collapse toggle */}
      <div className="border-t border-[#1e1e1e] p-3">
        {/* User */}
        {user && (
          <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
            {user.fotoPerfil ? (
              <img src={user.fotoPerfil} alt={user.nome} className="h-8 w-8 shrink-0 rounded-full object-cover border border-[#2a2a2a]" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#252525] text-xs font-bold text-[#d4a843]">
                {getInitials(user.nome)}
              </div>
            )}
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 overflow-hidden"
                >
                  <p className="truncate text-sm font-medium text-[#f5f5f5]">{user.nome}</p>
                  <p className="truncate text-xs text-[#6b6b6b]">{user.perfil}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={() => { logout(); window.location.href = '/login' }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#6b6b6b] transition-colors hover:bg-[#1e1e1e] hover:text-[#ef4444]"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Sair
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="mt-2 flex w-full items-center justify-center rounded-lg py-1.5 text-[#6b6b6b] transition-colors hover:bg-[#1e1e1e] hover:text-[#a0a0a0]"
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </motion.aside>
  )
}
