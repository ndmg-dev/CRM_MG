import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  Mail,
  UserMinus,
  Key,
  Moon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ICON_MAP } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { getInitials } from '@/lib/utils'
import { Button } from '@mg/ui'

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

export default function Sidebar() {
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

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 256 : 72 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-border bg-sidebar"
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
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
              <p className="text-sm font-semibold text-text-primary whitespace-nowrap">Mendonça Galvão</p>
              <p className="text-xs text-text-muted whitespace-nowrap">CRM Contábil</p>
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
                    ? 'bg-gold/10 text-gold'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                }`}
              >
                <div className="relative shrink-0">
                  <item.icon className="h-5 w-5" />
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute -left-[21px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gold"
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
                      const meta = SETOR_LABELS[setor] || { label: nomeSetor[setor] || setor, color: 'text-text-muted', activeClass: 'bg-gold/10 text-gold font-semibold' }
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

    {/* Footer: User info + collapse toggle */}
      <div className="border-t border-border p-3">
        {/* User Email */}
        {user && (
          <div className="mb-3 px-1">
            <AnimatePresence>
              {sidebarOpen && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="truncate text-sm font-medium text-gold"
                >
                  {user.email || 'admin@pontomg.local'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {/* Change Password (Visual only) */}
          <button className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary">
            <Key className="h-4 w-4 shrink-0" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
                  Alterar senha
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Logout */}
          <button
            onClick={async () => { await endUnifiedSession(); window.location.href = '/login' }}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
                  Sair
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Theme (Visual only) */}
          <button className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary">
            <Moon className="h-4 w-4 shrink-0" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
                  Tema escuro
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="mt-2 flex w-full items-center justify-center rounded-lg py-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-secondary"
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </motion.aside>
  )
}
