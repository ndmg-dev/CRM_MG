import { useState, useRef, useEffect } from 'react'
import { Bell, Search, Check, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { getInitials, formatDateTime } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'

export default function Header() {
  const currentPage = useUIStore((s) => s.currentPage)
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [showNotif, setShowNotif] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

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
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notificacoes.filter(n => !n.lida).length

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#1e1e1e] bg-[#0a0a0a]/80 px-6 backdrop-blur-md">
      {/* Page Title */}
      <h2 className="text-lg font-semibold text-[#f5f5f5]">{currentPage}</h2>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1.5 sm:flex">
          <Search className="h-4 w-4 text-[#6b6b6b]" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-40 bg-transparent text-sm text-[#f5f5f5] placeholder-[#6b6b6b] outline-none"
          />
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotif(!showNotif)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#a0a0a0] transition-colors hover:bg-[#1e1e1e] hover:text-[#f5f5f5]"
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
                className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#222222] px-4 py-3">
                  <h3 className="text-sm font-semibold text-[#f5f5f5]">Notificações</h3>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-[#d4a843]/10 px-2 py-0.5 text-xs font-medium text-[#d4a843]">
                      {unreadCount} novas
                    </span>
                  )}
                </div>
                
                <div className="max-h-[400px] overflow-y-auto">
                  {notificacoes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <Bell className="mb-2 h-8 w-8 text-[#333333]" />
                      <p className="text-sm text-[#6b6b6b]">Nenhuma notificação por enquanto.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#2a2a2a]">
                      {notificacoes.map((notif) => (
                        <div 
                          key={notif.id}
                          className={`relative flex items-start gap-3 p-4 transition-colors hover:bg-[#252525] ${
                            !notif.lida ? 'bg-[#222222]/50' : ''
                          }`}
                        >
                          {!notif.lida && (
                            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#d4a843]" />
                          )}
                          <div className={`flex-1 space-y-1 ${!notif.lida ? 'ml-0' : 'ml-5'}`}>
                            <p className={`text-sm ${!notif.lida ? 'font-medium text-[#f5f5f5]' : 'text-[#a0a0a0]'}`}>
                              {notif.titulo}
                            </p>
                            <p className="text-xs text-[#6b6b6b] line-clamp-2">
                              {notif.mensagem}
                            </p>
                            <p className="text-[10px] text-[#4a4a4a]">
                              {formatDateTime(notif.data_criacao)}
                            </p>
                          </div>
                          {!notif.lida && (
                            <button 
                              onClick={() => readMutation.mutate(notif.id)}
                              className="text-[#6b6b6b] hover:text-[#d4a843]"
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
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#252525] text-xs font-bold text-[#d4a843]">
            {getInitials(user.nome)}
          </div>
        )}
      </div>
    </header>
  )
}
