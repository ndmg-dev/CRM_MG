import { useState, useRef, useEffect } from 'react'
import { Bell, Search, Check, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { getInitials, formatDateTime } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useDebounce } from '@/hooks/useDebounce'
import { ICON_MAP } from '@/lib/icons'

export default function Header() {
  const currentPage = useUIStore((s) => s.currentPage)
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showNotif, setShowNotif] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['search', debouncedSearch],
    queryFn: () => api.search.query(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  })

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes'],
    queryFn: () => api.notificacoes.getAll(),
    enabled: !!user,
    refetchInterval: 30000, // poll every 30s
  })

  const readMutation = useMutation({
    mutationFn: (id: string) => api.notificacoes.marcarComoLida(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
    }
  })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notificacoes.filter(n => !n.lida).length

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      {/* Page Title */}
      <h2 className="text-lg font-semibold text-text-primary">{currentPage}</h2>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block" ref={searchRef}>
          <div className={`flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 transition-colors ${isSearchFocused ? 'border-gold' : 'border-border'
            }`}>
            <Search className="h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar (sistemas, clientes...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="w-56 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
            />
          </div>

          {/* Search Results Overlay */}
          <AnimatePresence>
            {isSearchFocused && searchQuery.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              >
                <div className="max-h-[400px] overflow-y-auto p-2">
                  {isSearching ? (
                    <div className="py-8 text-center text-sm text-text-secondary">Buscando...</div>
                  ) : searchResults?.results.length === 0 ? (
                    <div className="py-8 text-center text-sm text-text-secondary">Nenhum resultado encontrado.</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {searchResults?.results.map((result) => {
                        const Icon = ICON_MAP[result.icon || 'building-2'] || ICON_MAP['building-2']
                        return (
                          <div
                            key={result.id}
                            onClick={() => {
                              navigate(result.url)
                              setIsSearchFocused(false)
                              setSearchQuery('')
                            }}
                            className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-hover"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-raised text-gold">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="truncate text-sm font-medium text-text-primary">{result.title}</span>
                              {result.subtitle && (
                                <span className="truncate text-[10px] text-text-secondary">{result.subtitle}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-[0_0_0_2px_#0a0a0a]">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotif && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-3">
                  <h3 className="text-sm font-semibold text-text-primary">Notificações</h3>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                      {unreadCount} novas
                    </span>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {notificacoes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <Bell className="mb-2 h-8 w-8 text-border-light" />
                      <p className="text-sm text-text-muted">Nenhuma notificação por enquanto.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-divider">
                      {notificacoes.map((notif) => (
                        <div
                          key={notif.id}
                          className={`relative flex items-start gap-3 p-4 transition-colors hover:bg-surface-hover ${!notif.lida ? 'bg-surface-raised/50' : ''
                            }`}
                        >
                          {!notif.lida && (
                            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
                          )}
                          <div className={`flex-1 space-y-1 ${!notif.lida ? 'ml-0' : 'ml-5'}`}>
                            <p className={`text-sm ${!notif.lida ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                              {notif.titulo}
                            </p>
                            <p className="text-xs text-text-muted line-clamp-2">
                              {notif.mensagem}
                            </p>
                            <p className="text-[10px] text-border-emphasis">
                              {formatDateTime(notif.data_criacao)}
                            </p>
                          </div>
                          {!notif.lida && (
                            <button
                              onClick={() => readMutation.mutate(notif.id)}
                              className="text-text-muted hover:text-gold"
                              title="Marcar como lida"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User avatar */}
        {user && (
          user.fotoPerfil ? (
            <img src={user.fotoPerfil} alt={user.nome} className="h-9 w-9 rounded-full object-cover border border-border" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-hover text-xs font-bold text-gold">
              {getInitials(user.nome)}
            </div>
          )
        )}
      </div>
    </header>
  )
}
