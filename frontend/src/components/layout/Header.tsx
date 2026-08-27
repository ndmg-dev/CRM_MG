import { useState, useRef, useEffect } from 'react'
import { Bell, Search, CheckCircle2, Menu, MessageSquare } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { getInitials, formatDateTime } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useDebounce } from '@/hooks/useDebounce'
import { ICON_MAP } from '@/lib/icons'
import { supabase as suporteSupabase } from '@/systems/central-suporte/integrations/supabase/client'
import { playNotificationSound } from '@/systems/central-suporte/lib/notification-sound'
import { showBrowserNotification, requestBrowserNotificationPermission } from '@/systems/central-suporte/hooks/useBrowserNotifications'
import { useChatWidgetStore } from '@/stores/chatWidgetStore'
import { useUIStore } from '@/stores/uiStore'

interface HeaderProps {
  /** Abre o drawer de navegação em telas < lg. */
  onMenuClick?: () => void
}

const MESSAGE_TITLE = 'Novo comentário'

/** Notificação normalizada, venha ela do CRM (`notificacoes`) ou da Central
 * de Suporte (`notifications`) — o dropdown de Notificações mistura as duas. */
interface MergedNotification {
  id: string
  source: 'crm' | 'suporte' | 'release'
  titulo: string
  mensagem: string
  lida: boolean
  data_criacao: string
  ticketId?: string | null
}

export default function Header({ onMenuClick }: HeaderProps) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const openConversation = useChatWidgetStore((s) => s.openConversation)
  const fullBleedSystem = useUIStore((s) => s.fullBleedSystem)
  const [showNotif, setShowNotif] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const debouncedSearch = useDebounce(searchQuery, 300)

  // Usuário da Central de Suporte (Supabase separado, sessão unificada no
  // login) — precisa pra filtrar notificações só das minhas, sem depender
  // só da RLS pra não misturar chamado de outra pessoa no badge.
  const [suporteUserId, setSuporteUserId] = useState<string | null>(null)
  useEffect(() => {
    suporteSupabase.auth.getUser().then(({ data }) => setSuporteUserId(data.user?.id ?? null))
  }, [])

  // Pede a permissão de notificação do navegador aqui (Header é global, monta
  // em toda página do CRM) — pedir só dentro do sistema Central de Suporte
  // (central-suporte/App.tsx) deixava sem notificação do SO quem recebe
  // chamado mas nunca abriu aquele sistema diretamente.
  useEffect(() => {
    if (suporteUserId) requestBrowserNotificationPermission()
  }, [suporteUserId])

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['search', debouncedSearch],
    queryFn: () => api.search.query(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  })

  // --- Notificações nativas do CRM ---
  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes'],
    queryFn: () => api.notificacoes.getAll(),
    enabled: !!user,
    refetchInterval: 30000,
  })

  // --- Notificações de chamado (Central de Suporte, sem comentários) ---
  const { data: suporteNotifs = [] } = useQuery({
    queryKey: ['suporte-notificacoes', suporteUserId],
    queryFn: async () => {
      const { data, error } = await suporteSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', suporteUserId as string)
        .neq('title', MESSAGE_TITLE)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
    enabled: !!suporteUserId,
  })

  // --- Mensagens (comentários de chamado) ---
  const { data: messageNotifs = [] } = useQuery({
    queryKey: ['suporte-mensagens', suporteUserId],
    queryFn: async () => {
      const { data, error } = await suporteSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', suporteUserId as string)
        .eq('title', MESSAGE_TITLE)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
    enabled: !!suporteUserId,
  })

  // --- Atualizações do CRM (releases) ---
  const { data: releases = [] } = useQuery({
    queryKey: ['releases'],
    queryFn: () => api.releases.getAll(),
    enabled: !!user,
  })

  const merged: MergedNotification[] = [
    ...notificacoes.map((n) => ({
      id: n.id, source: 'crm' as const, titulo: n.titulo, mensagem: n.mensagem,
      lida: n.lida, data_criacao: n.data_criacao,
    })),
    ...suporteNotifs.map((n) => ({
      id: n.id, source: 'suporte' as const, titulo: n.title, mensagem: n.message || '',
      lida: n.is_read, data_criacao: n.created_at, ticketId: n.ticket_id,
    })),
    ...releases.map((r) => ({
      id: r.id, source: 'release' as const,
      titulo: `Seu CRM foi atualizado — v${r.version} 🎉`,
      mensagem: r.notes.map((n) => `${n.systemName}: ${n.description}`).join(' · '),
      lida: r.isRead, data_criacao: r.releasedAt,
    })),
  ].sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime())

  const unreadCount = merged.filter((n) => !n.lida).length
  const unreadMessages = messageNotifs.filter((n) => !n.is_read).length

  const { data: sistemas } = useQuery({
    queryKey: ['sistemas'],
    queryFn: () => api.sistemas.getAll(),
  })
  const centralSuporteId = sistemas?.find(
    (s) => s.slug === 'central-de-suporte' || s.slug === 'central-suporte'
  )?.id

  const readMutation = useMutation({
    mutationFn: (id: string) => api.notificacoes.marcarComoLida(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
    }
  })

  const markSuporteRead = async (id: string) => {
    await suporteSupabase.from('notifications').update({ is_read: true }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['suporte-notificacoes'] })
  }

  const markReleaseRead = async (id: string) => {
    await api.releases.marcarComoLida(id)
    queryClient.invalidateQueries({ queryKey: ['releases'] })
    queryClient.invalidateQueries({ queryKey: ['latest-unread-release'] })
  }

  const markMessageRead = async (id: string) => {
    await suporteSupabase.from('notifications').update({ is_read: true }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['suporte-mensagens'] })
    queryClient.invalidateQueries({ queryKey: ['unread-comment-counts'] })
  }

  const markAllNotifRead = async () => {
    const unread = merged.filter((n) => !n.lida)
    if (!unread.length) return
    const suporteIds = unread.filter((n) => n.source === 'suporte').map((n) => n.id)
    await Promise.all([
      ...unread.filter((n) => n.source === 'crm').map((n) => api.notificacoes.marcarComoLida(n.id)),
      ...unread.filter((n) => n.source === 'release').map((n) => markReleaseRead(n.id)),
      suporteIds.length
        ? suporteSupabase.from('notifications').update({ is_read: true }).in('id', suporteIds)
        : Promise.resolve(),
    ])
    queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
    queryClient.invalidateQueries({ queryKey: ['suporte-notificacoes'] })
  }

  const markAllMessagesRead = async () => {
    const unread = messageNotifs.filter((n) => !n.is_read)
    if (!unread.length) return
    await suporteSupabase.from('notifications').update({ is_read: true }).in('id', unread.map((n) => n.id))
    queryClient.invalidateQueries({ queryKey: ['suporte-mensagens'] })
    queryClient.invalidateQueries({ queryKey: ['unread-comment-counts'] })
  }

  // Realtime: chamados + mensagens da Central de Suporte
  useEffect(() => {
    let cleanup: (() => void) | undefined
    const setup = async () => {
      const { data: { user: suporteUser } } = await suporteSupabase.auth.getUser()
      if (!suporteUser) return

      const channel = suporteSupabase
        .channel('header-suporte-notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${suporteUser.id}` },
          (payload: any) => {
            const record = payload?.new
            const isMessage = !!record?.title?.includes(MESSAGE_TITLE)

            if (isMessage) {
              queryClient.invalidateQueries({ queryKey: ['suporte-mensagens'] })
              queryClient.invalidateQueries({ queryKey: ['unread-comment-counts'] })
              playNotificationSound('comment_received')
            } else {
              queryClient.invalidateQueries({ queryKey: ['suporte-notificacoes'] })
              const title: string = record?.title || ''
              const isClosing = /encerrad|fechad|resolvid|cancelad/i.test(title)
              if (record?.ticket_id && !isClosing) {
                suporteSupabase.from('tickets').select('assignee_id').eq('id', record.ticket_id).single().then(({ data: ticket }) => {
                  playNotificationSound('ticket_opened', ticket?.assignee_id)
                })
              } else {
                playNotificationSound(isClosing ? 'ticket_closed' : 'ticket_opened')
              }
            }
            // Mensagem nova NUNCA dispara notificação nativa do navegador —
            // já tem som + badge no ícone flutuante pra isso, e a notificação
            // do SO cobria o widget e atrapalhava responder. Só eventos de
            // chamado (aberto/encerrado) continuam gerando notificação nativa.
            if (record && !isMessage) {
              showBrowserNotification(record.title || 'Nova notificação', record.message || '')
            }
          }
        )
        .subscribe()

      cleanup = () => { suporteSupabase.removeChannel(channel) }
    }
    setup()
    return () => cleanup?.()
  }, [queryClient])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
      if (messagesRef.current && !messagesRef.current.contains(e.target as Node)) {
        setShowMessages(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const goToChamados = () => {
    if (centralSuporteId) navigate(`/sistemas/${centralSuporteId}`)
  }

  const handleNotifClick = (n: MergedNotification) => {
    if (n.source === 'crm') {
      readMutation.mutate(n.id)
    } else if (n.source === 'release') {
      markReleaseRead(n.id)
    } else {
      markSuporteRead(n.id)
      setShowNotif(false)
      if (n.ticketId) goToChamados()
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-border bg-header-gradient px-4 shadow-header backdrop-blur-md lg:px-5">
      {/* Menu (drawer). O título da página não vive aqui: toda página já tem o
          seu — PageHeader, ou um `h1` próprio em Dashboard e ClientDetail —
          e repeti-lo na barra deixava o mesmo texto duas vezes na tela. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu de navegação"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface hover:text-text-primary lg:hidden"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        {/* Menu do sistema aberto (Central de Suporte, etc.) — portalizado
            aqui de dentro do próprio sistema, pra virar uma barra só com o
            resto do Header em vez de duas empilhadas. */}
        <div id="system-menu-slot" className="flex min-w-0 flex-1 items-center justify-center" />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search — só faz sentido navegando o CRM; some com um sistema
            nativo aberto pra abrir espaço pro menu dele. */}
        {!fullBleedSystem && (
        <div className="relative hidden sm:block" ref={searchRef}>
          <div className={`flex h-9 items-center gap-2 rounded-lg border bg-search-field px-3 shadow-search-field transition-colors ${isSearchFocused ? 'border-gold-border' : 'border-gold-border-soft'
            }`}>
            <Search className="h-4 w-4 shrink-0 text-gold" />
            <input
              type="text"
              placeholder="Buscar (sistemas, clientes...)"
              aria-label="Buscar sistemas e clientes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="w-44 bg-transparent text-[13px] text-text-primary placeholder-text-muted outline-none xl:w-56"
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
        )}

        {/* Mensagens (comentários de chamado) */}
        <div className="relative" ref={messagesRef}>
          <button
            onClick={() => { setShowMessages(!showMessages); setShowNotif(false) }}
            aria-label={unreadMessages > 0 ? `Mensagens (${unreadMessages} não lidas)` : 'Mensagens'}
            aria-expanded={showMessages}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            <MessageSquare className="h-4 w-4" />
            {unreadMessages > 0 && (
              <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-background">
                {unreadMessages}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showMessages && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-3">
                  <h3 className="text-sm font-semibold text-text-primary">Mensagens</h3>
                  {unreadMessages > 0 && (
                    <button className="text-xs text-gold hover:underline" onClick={markAllMessagesRead}>
                      Marcar tudo como lido
                    </button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {messageNotifs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <MessageSquare className="mb-2 h-8 w-8 text-border-light" />
                      <p className="text-sm text-text-muted">Nenhuma mensagem por enquanto.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-divider">
                      {messageNotifs.map((n) => (
                        <div
                          key={n.id}
                          className={`relative flex items-start gap-3 p-4 transition-colors hover:bg-surface-hover cursor-pointer ${!n.is_read ? 'bg-surface-raised/50' : ''}`}
                          onClick={() => {
                            markMessageRead(n.id)
                            setShowMessages(false)
                            if (n.ticket_id) openConversation(n.ticket_id)
                          }}
                        >
                          {!n.is_read && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />}
                          <div className={`flex-1 space-y-1 ${!n.is_read ? 'ml-0' : 'ml-5'}`}>
                            <p className={`text-sm ${!n.is_read ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                              {n.title}
                            </p>
                            {n.message && <p className="text-xs text-text-muted line-clamp-2">{n.message}</p>}
                            <p className="text-[10px] text-border-emphasis">{formatDateTime(n.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notificações (CRM + chamados) */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotif(!showNotif); setShowMessages(false) }}
            aria-label={
              unreadCount > 0
                ? `Notificações (${unreadCount} não lidas)`
                : 'Notificações'
            }
            aria-expanded={showNotif}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-background">
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
                <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-3">
                  <h3 className="shrink-0 text-sm font-semibold text-text-primary">Notificações</h3>
                  {unreadCount > 0 && (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                        {unreadCount} novas
                      </span>
                      <button
                        className="shrink-0 whitespace-nowrap text-xs text-gold hover:underline"
                        onClick={markAllNotifRead}
                      >
                        Marcar tudo
                      </button>
                    </div>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {merged.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <Bell className="mb-2 h-8 w-8 text-border-light" />
                      <p className="text-sm text-text-muted">Nenhuma notificação por enquanto.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-divider">
                      {merged.map((notif) => (
                        <div
                          key={`${notif.source}-${notif.id}`}
                          className={`relative flex items-start gap-3 p-4 transition-colors hover:bg-surface-hover ${notif.source !== 'crm' ? 'cursor-pointer' : ''} ${!notif.lida ? 'bg-gold/[0.06]' : ''
                            }`}
                          onClick={() => notif.source !== 'crm' && handleNotifClick(notif)}
                        >
                          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-gold-muted text-gold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </div>
                          <div className={`flex-1 space-y-1`}>
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
                          {!notif.lida && notif.source === 'crm' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); readMutation.mutate(notif.id) }}
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
            <img src={user.fotoPerfil} alt={user.nome} title={user.nome} className="h-8 w-8 rounded-full border border-border object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div
              title={user.nome}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gold-border bg-gold-muted text-[11px] font-bold text-gold"
            >
              <span className="sr-only">{user.nome}</span>
              <span aria-hidden="true">{getInitials(user.nome)}</span>
            </div>
          )
        )}
      </div>
    </header>
  )
}
