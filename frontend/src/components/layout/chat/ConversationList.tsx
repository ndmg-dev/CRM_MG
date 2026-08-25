import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useChatWidgetStore } from '@/stores/chatWidgetStore'
import { supabase } from '@/systems/central-suporte/integrations/supabase/client'
import { useUnreadComments } from '@/systems/central-suporte/hooks/useUnreadComments'

interface ConversationRow {
  ticketId: string
  ticketCode: number | string | null
  title: string
  requesterName: string
  lastMessage: string
  lastMessageAt: string | null
}

/** Lista de conversas do chat flutuante: um chamado por linha, ordenado pela
 * mensagem mais recente. Não depende de "sou responsável/abri esse chamado"
 * — o RLS de `comments`/`tickets` já restringe o que a pessoa pode ver, então
 * a lista só reflete isso. */
function useConversations() {
  return useQuery({
    queryKey: ['chat-widget-conversations'],
    queryFn: async (): Promise<ConversationRow[]> => {
      // 1) Comentários recentes (visíveis, não internos) — o mais recente por
      // chamado é o que aparece como prévia e define a ordenação.
      const { data: recentComments, error } = await supabase
        .from('comments')
        .select('ticket_id, content, created_at')
        .eq('internal_only', false)
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error

      const lastByTicket = new Map<string, { content: string; created_at: string }>()
      for (const c of recentComments || []) {
        if (!c.ticket_id || lastByTicket.has(c.ticket_id)) continue
        lastByTicket.set(c.ticket_id, { content: c.content || '', created_at: c.created_at! })
      }
      const ticketIds = Array.from(lastByTicket.keys()).slice(0, 30)
      if (ticketIds.length === 0) return []

      // 2) Dados do chamado (título, código, quem abriu) pros ids acima.
      const { data: tickets, error: tErr } = await supabase
        .from('tickets')
        .select('id, ticket_code, title, requester:profiles!requester_id(full_name)')
        .in('id', ticketIds)
        .is('archived_at', null)
      if (tErr) throw tErr

      const ticketMap = new Map((tickets || []).map((t: any) => [t.id, t]))
      return ticketIds
        .filter((id) => ticketMap.has(id))
        .map((id) => {
          const t = ticketMap.get(id) as any
          const last = lastByTicket.get(id)!
          return {
            ticketId: id,
            ticketCode: t.ticket_code,
            title: t.title,
            requesterName: t.requester?.full_name || 'Desconhecido',
            lastMessage: last.content,
            lastMessageAt: last.created_at,
          }
        })
    },
  })
}

function formatPreviewTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  if (diffDays === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function Avatar({ name }: { name: string }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-muted border border-gold-border text-xs font-bold text-gold">
      {letter}
    </div>
  )
}

export function ConversationList() {
  const close = useChatWidgetStore((s) => s.close)
  const openConversation = useChatWidgetStore((s) => s.openConversation)
  const queryClient = useQueryClient()
  const { data: conversations = [], isLoading } = useConversations()
  const unreadCounts = useUnreadComments()

  // Realtime: qualquer comentário novo em qualquer chamado pode mudar a
  // ordem/prévia da lista — invalida em vez de tentar reconciliar campo a
  // campo (lista é pequena, refetch é barato).
  useEffect(() => {
    const channel = supabase
      .channel('chat-widget-conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        () => queryClient.invalidateQueries({ queryKey: ['chat-widget-conversations'] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  return (
    <div className="fixed bottom-4 right-4 z-[110] flex h-[480px] w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-3 py-2.5">
        <h3 className="text-sm font-semibold text-text-primary">Conversas</h3>
        <button
          onClick={close}
          aria-label="Fechar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="pt-8 text-center text-xs text-text-muted">Carregando...</p>
        ) : conversations.length === 0 ? (
          <p className="pt-8 text-center text-xs text-text-muted">Nenhuma conversa ainda.</p>
        ) : (
          conversations.map((c) => {
            const unread = unreadCounts[c.ticketId] || 0
            return (
              <button
                key={c.ticketId}
                onClick={() => openConversation(c.ticketId)}
                className="flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-surface"
              >
                <Avatar name={c.requesterName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 rounded border border-gold-border-soft px-1 py-0.5 text-[9px] font-bold text-gold">
                        #{String(c.ticketCode ?? '').padStart(3, '0')}
                      </span>
                      <span className="truncate text-[13px] font-semibold text-text-primary">{c.title}</span>
                    </div>
                    <span className="shrink-0 text-[10px] text-text-muted">{formatPreviewTime(c.lastMessageAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-text-muted">{c.requesterName}</p>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-text-secondary">{c.lastMessage || 'Sem mensagens de texto'}</p>
                    {unread > 0 && (
                      <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-background">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
