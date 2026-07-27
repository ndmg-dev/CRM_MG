import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Building2, Calculator, Plane, BarChart3, Receipt, Headphones, Bot, Sparkles, Cpu, CalendarCheck, MessageCircle, Clock, UserCircle, Percent, LayoutGrid, List, FileText, Calendar, User, DollarSign, Store, Megaphone, Target, Palmtree, FileCheck, Fingerprint, HandCoins, Mail, UserMinus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Sistema } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import PageHeader from '@/components/common/PageHeader'
import { ICON_MAP } from '@/lib/icons'


function SystemCard({ sistema }: { sistema: Sistema }) {
  const Icon = ICON_MAP[sistema.icone] || Building2

  const isAutomation = sistema.categoria === 'AUTOMATION'
  const isStatic = sistema.categoria === 'STATIC'
  
  let colorClass = 'text-gold'
  let bgClass = 'bg-gold/10 group-hover:bg-gold/20'
  let borderHoverClass = 'hover:border-gold/50'

  if (isAutomation) {
    colorClass = 'text-purple-400'
    bgClass = 'bg-purple-500/10 group-hover:bg-purple-500/20'
    borderHoverClass = 'hover:border-purple-500/50'
  } else if (isStatic) {
    colorClass = 'text-text-muted'
    bgClass = 'bg-divider/50 group-hover:bg-divider'
    borderHoverClass = 'hover:border-text-muted/50'
  }

  return (
    <Link to={`/sistemas/${sistema.id}`}>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
        className={`group flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center transition-all ${borderHoverClass}`}
      >
        <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${bgClass} ${colorClass}`}>
          <Icon className="h-8 w-8" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary transition-colors group-hover:text-white">
          {sistema.nome}
        </h3>
      </motion.div>
    </Link>
  )
}

export default function SystemsHub() {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  useEffect(() => { setCurrentPage('Sistemas') }, [setCurrentPage])

  const [activeTab, setActiveTab] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { data: sistemas = [], isLoading } = useQuery({
    queryKey: ['sistemas'],
    queryFn: () => api.sistemas.getAll(),
  })

  const { data: setores = [] } = useQuery({
    queryKey: ['setores'],
    queryFn: () => api.setores.getAll(),
  })

  // As abas saem dos sistemas que o backend de fato liberou — assim um setor
  // novo aparece sozinho e nenhuma aba fica vazia.
  const tabs = useMemo(() => {
    const nomePorCodigo = Object.fromEntries(setores.map((s) => [s.codigo, s.nome]))
    const presentes = [...new Set(sistemas.map((s) => s.setor ?? 'GERAL'))]
    const ordenados = presentes.sort((a, b) =>
      (nomePorCodigo[a] || a).localeCompare(nomePorCodigo[b] || b)
    )
    return [
      { key: 'ALL', label: 'Todos' },
      ...ordenados.map((codigo) => ({ key: codigo, label: nomePorCodigo[codigo] || codigo })),
    ]
  }, [sistemas, setores])

  // A visibilidade é decidida no backend, pela política do setor do usuário
  // (ver services/visibility_service.py). Refiltrar aqui reintroduziria uma
  // regra paralela e esconderia sistemas que o setor tem direito de ver.
  const filtered = sistemas.filter((s) => {
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
        <div className="flex flex-wrap gap-1 rounded-lg bg-card p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-gold text-black'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar sistema..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
            />
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded p-1.5 transition-colors ${
                viewMode === 'grid' ? 'bg-gold text-black' : 'text-text-muted hover:text-text-primary'
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded p-1.5 transition-colors ${
                viewMode === 'list' ? 'bg-gold text-black' : 'text-text-muted hover:text-text-primary'
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
        <motion.div layout className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="border-b border-border bg-sidebar text-xs uppercase text-text-muted">
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
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-text-secondary transition-colors hover:bg-border-light">
                          <Icon className="h-5 w-5" />
                          
                          {/* Tooltip */}
                          <div className="pointer-events-none absolute left-14 top-1/2 z-50 w-64 -translate-y-1/2 rounded-lg border border-border-emphasis bg-card p-3 text-xs font-normal text-text-secondary opacity-0 shadow-xl transition-all group-hover:opacity-100 group-hover:translate-x-1">
                            {s.descricao}
                            <div className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-border-emphasis bg-card" />
                          </div>
                        </div>
                        <span className="font-medium text-text-primary">{s.nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.categoria === 'AUTOMATION'
                          ? 'bg-purple-500/10 text-purple-400'
                          : 'bg-gold/10 text-gold'
                      }`}>
                        {s.categoria === 'AUTOMATION' ? 'Automação' : 'Principal'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/sistemas/${s.id}`}
                        className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gold-hover active:bg-gold-active"
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
