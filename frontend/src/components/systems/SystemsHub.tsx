import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Building2, Calculator, Plane, BarChart3, Receipt, Headphones, Bot, Sparkles, Cpu, CalendarCheck, MessageCircle, Clock, UserCircle, Percent, LayoutGrid, List, FileText, Calendar, User, DollarSign, Store, Megaphone, Target, Palmtree, FileCheck, Fingerprint, HandCoins, Mail, UserMinus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Sistema, SetorSistema } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import PageHeader from '@/components/common/PageHeader'
import { ICON_MAP } from '@/lib/icons'

const SETOR_TABS: { key: SetorSistema | 'ALL'; label: string; color: string }[] = [
  { key: 'ALL', label: 'Todos', color: '' },
  { key: 'DP', label: 'Dep. Pessoal', color: 'text-blue-400' },
  { key: 'CONTABIL', label: 'Contábil', color: 'text-emerald-400' },
  { key: 'FISCAL', label: 'Fiscal', color: 'text-orange-400' },
  { key: 'SOCIETARIO', label: 'Societário', color: 'text-purple-400' },
  { key: 'TI', label: 'Tecnologia (TI)', color: 'text-cyan-400' },
  { key: 'GERAL', label: 'Geral', color: 'text-[#a0a0a0]' },
  { key: 'RESTRITO', label: 'Restrito', color: 'text-red-500' },
]

function SystemCard({ sistema }: { sistema: Sistema }) {
  const Icon = ICON_MAP[sistema.icone] || Building2

  const isAutomation = sistema.categoria === 'AUTOMATION'
  const colorClass = isAutomation ? 'text-purple-400' : 'text-[#d4a843]'
  const bgClass = isAutomation ? 'bg-purple-500/10 group-hover:bg-purple-500/20' : 'bg-[#d4a843]/10 group-hover:bg-[#d4a843]/20'
  const borderHoverClass = isAutomation ? 'hover:border-purple-500/50' : 'hover:border-[#d4a843]/50'

  return (
    <Link to={`/sistemas/${sistema.id}`}>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
        className={`group flex h-full flex-col items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 text-center transition-all ${borderHoverClass}`}
      >
        <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${bgClass} ${colorClass}`}>
          <Icon className="h-8 w-8" />
        </div>
        <h3 className="text-sm font-semibold text-[#f5f5f5] transition-colors group-hover:text-white">
          {sistema.nome}
        </h3>
      </motion.div>
    </Link>
  )
}

export default function SystemsHub() {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  useEffect(() => { setCurrentPage('Sistemas') }, [setCurrentPage])

  const [activeTab, setActiveTab] = useState<SetorSistema | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { data: sistemas = [], isLoading } = useQuery({
    queryKey: ['sistemas'],
    queryFn: () => api.sistemas.getAll(),
  })

  const user = useAuthStore((s) => s.user)
  const isManager = user?.perfil === 'ADMIN' || user?.perfil === 'COORDENADOR'

  // Visibility filter:
  // - RESTRITO is ONLY visible to ADMIN
  // - Managers (ADMIN/COORDENADOR) see all other sectors
  // - Others see only their own setor + GERAL
  const visibleSistemas = sistemas.filter((s) => {
    const setorSistema = s.setor ?? 'GERAL'
    if (setorSistema === 'RESTRITO') {
      return user?.perfil === 'ADMIN'
    }
    if (isManager) return true
    return setorSistema === 'GERAL' || setorSistema === user?.setor
  })

  const filtered = visibleSistemas.filter((s) => {
    const matchesTab = activeTab === 'ALL' || (s.setor ?? 'GERAL') === activeTab
    const matchesSearch = !search ||
      s.nome.toLowerCase().includes(search.toLowerCase()) ||
      s.descricao.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  return (
    <div>
      <PageHeader
        title="Central de Sistemas"
        description="Acesse todas as ferramentas do ecossistema Mendonça Galvão"
      />

      {/* Tabs + Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-[#1a1a1a] p-1">
          {SETOR_TABS.map((tab) => {
            // Hide RESTRITO tab for non-admins
            if (tab.key === 'RESTRITO' && user?.perfil !== 'ADMIN') return null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#d4a843] text-black'
                    : `text-[#a0a0a0] hover:text-[#f5f5f5] ${tab.color}`
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
            <Search className="h-4 w-4 text-[#6b6b6b]" />
            <input
              type="text"
              placeholder="Buscar sistema..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 bg-transparent text-sm text-[#f5f5f5] placeholder-[#6b6b6b] outline-none"
            />
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded p-1.5 transition-colors ${
                viewMode === 'grid' ? 'bg-[#d4a843] text-black' : 'text-[#6b6b6b] hover:text-[#f5f5f5]'
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded p-1.5 transition-colors ${
                viewMode === 'list' ? 'bg-[#d4a843] text-black' : 'text-[#6b6b6b] hover:text-[#f5f5f5]'
              }`}
              title="Visualização em Lista"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner label="Carregando sistemas..." />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum sistema encontrado" description="Tente ajustar os filtros de busca." />
      ) : viewMode === 'grid' ? (
        <motion.div
          layout
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {filtered.map((s) => (
            <SystemCard key={s.id} sistema={s} />
          ))}
        </motion.div>
      ) : (
        <motion.div layout className="overflow-x-auto rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
          <table className="w-full text-left text-sm text-[#a0a0a0]">
            <thead className="border-b border-[#2a2a2a] bg-[#111111] text-xs uppercase text-[#6b6b6b]">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">Sistema</th>
                <th scope="col" className="px-6 py-4 font-medium">Categoria</th>
                <th scope="col" className="px-6 py-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const Icon = ICON_MAP[s.icone] || Building2
                return (
                  <tr key={s.id} className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#252525]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#252525] text-[#a0a0a0] transition-colors hover:bg-[#333333]">
                          <Icon className="h-5 w-5" />
                          
                          {/* Tooltip */}
                          <div className="pointer-events-none absolute left-14 top-1/2 z-50 w-64 -translate-y-1/2 rounded-lg border border-[#3a3a3a] bg-[#1a1a1a] p-3 text-xs font-normal text-[#a0a0a0] opacity-0 shadow-xl transition-all group-hover:opacity-100 group-hover:translate-x-1">
                            {s.descricao}
                            <div className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-[#3a3a3a] bg-[#1a1a1a]" />
                          </div>
                        </div>
                        <span className="font-medium text-[#f5f5f5]">{s.nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.categoria === 'AUTOMATION'
                          ? 'bg-purple-500/10 text-purple-400'
                          : 'bg-[#d4a843]/10 text-[#d4a843]'
                      }`}>
                        {s.categoria === 'AUTOMATION' ? 'Automação' : 'Principal'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/sistemas/${s.id}`}
                        className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#d4a843] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#c9952b] active:bg-[#b8941f]"
                      >
                        Acessar
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  )
}
